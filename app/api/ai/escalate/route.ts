import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { ESCALATION_SUMMARY_PROMPT } from '@/lib/support-prompt'
import { validateApiRequest } from '@/lib/api-auth'
import { checkRateLimit, recordApiKeyUsage } from '@/lib/api-keys'
import { z } from 'zod'

// Zod schema for parsing AI-generated escalation summary
const EscalationSummarySchema = z.object({
  subject: z.string().max(100).default('Support request from AI chat'),
  summary: z.string().default(''),
  category_suggestion: z.enum(['hardware', 'software', 'network', 'account', 'email', 'security', 'other']).default('other'),
  priority_suggestion: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  solutions_attempted: z.array(z.string()).default([]),
})

// Zod schema for request body validation
const EscalateRequestSchema = z.object({
  session_id: z.string().uuid(),
  preview: z.boolean().optional().default(false),
  user_edits: z.object({
    subject: z.string().max(500).optional(),
    description: z.string().optional(),
  }).optional(),
})

interface AIProvider {
  id: string
  provider_type: string
  api_url: string
  api_key_encrypted: string | null
  is_local: boolean
}

interface AIModel {
  model_name: string
  temperature: number
  max_tokens: number
}

/**
 * POST /api/ai/escalate
 * Escalate a chat session to a support ticket.
 *
 * If preview=true: returns AI-generated summary without creating a ticket.
 * If preview=false: creates the ticket, links it to the session, returns ticket info.
 */
export async function POST(request: NextRequest) {
  try {
    // --- Dual-auth: session first, then API key fallback ---
    let userId: string
    let orgId: string
    let apiKeyId: string | undefined
    let authCtx: Awaited<ReturnType<typeof getAuthContext>> = null

    const ctx = await getAuthContext(request)

    if (ctx) {
      authCtx = ctx
      userId = ctx.userId
      orgId = ctx.orgId
    } else {
      // Fall back to API key auth
      const apiResult = await validateApiRequest(request)
      if (apiResult instanceof NextResponse) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      userId = apiResult.userId
      orgId = apiResult.orgId
      apiKeyId = apiResult.keyId

      // Rate limit check for API key requests
      if (apiKeyId) {
        const keyRow = await queryOne<{ rate_limit: number }>(
          'SELECT rate_limit FROM api_keys WHERE id = $1',
          [apiKeyId]
        )
        const limit = keyRow?.rate_limit ?? 0
        if (!checkRateLimit(apiKeyId, limit)) {
          return NextResponse.json(
            { success: false, error: 'Rate limit exceeded' },
            { status: 429 }
          )
        }
        // Record usage (fire and forget)
        recordApiKeyUsage(apiKeyId).catch(() => {})
      }
    }

    // Validate request body
    const body = await request.json()
    const parseResult = EscalateRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { session_id, preview, user_edits } = parseResult.data

    // Fetch the chat session and verify ownership
    const chatSession = await queryOne<{
      id: string
      user_id: string | null
      organization_id: string
      title: string | null
      resolution_status: string | null
      created_ticket_id: string | null
    }>(
      `SELECT id, user_id, organization_id, title, resolution_status, created_ticket_id
       FROM ai_chat_sessions
       WHERE id = $1 AND organization_id = $2`,
      [session_id, orgId]
    )

    if (!chatSession) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check access: session owner or admin
    const isOwner = chatSession.user_id === userId

    if (!isOwner) {
      let isAdmin = false
      if (authCtx) {
        isAdmin = authCtx.session.user.role === 'admin'
      } else {
        const userRow = await queryOne<{ role: string }>('SELECT role FROM "user" WHERE id = $1', [userId])
        isAdmin = userRow?.role === 'admin'
      }

      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // If a ticket was already created for this session, return it (idempotent)
    if (chatSession.created_ticket_id && !preview) {
      const existingTicket = await queryOne<{
        id: string
        ticket_number: number
        prefix: string
        subject: string
      }>(
        `SELECT id, ticket_number, prefix, subject
         FROM tickets
         WHERE id = $1 AND organization_id = $2`,
        [chatSession.created_ticket_id, orgId]
      )

      if (existingTicket) {
        return NextResponse.json({
          success: true,
          data: {
            ticket_id: existingTicket.id,
            ticket_number: `${existingTicket.prefix}-${existingTicket.ticket_number}`,
            subject: existingTicket.subject,
            already_created: true,
          },
        })
      }
    }

    // Fetch all messages for this session
    const messages = await query<{
      role: string
      content: string
      created_at: string
    }>(
      `SELECT role, content, created_at
       FROM ai_chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [session_id]
    )

    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages in this session' },
        { status: 400 }
      )
    }

    // Build conversation transcript
    const transcript = messages
      .map(m => `${m.role === 'user' ? 'User' : 'AI Assistant'}: ${m.content}`)
      .join('\n\n')

    // Generate AI summary
    let escalationData = await generateEscalationSummary(orgId, transcript)

    // For preview mode, return the summary for user review
    if (preview) {
      // Apply user edits to the preview if provided
      if (user_edits?.subject) {
        escalationData.subject = user_edits.subject
      }

      const previewDescription = buildTicketDescription(
        user_edits?.description || escalationData.summary,
        escalationData.solutions_attempted,
        session_id
      )

      return NextResponse.json({
        success: true,
        data: {
          preview: true,
          subject: escalationData.subject,
          description: previewDescription,
          raw_summary: escalationData.summary,
          category_suggestion: escalationData.category_suggestion,
          priority_suggestion: escalationData.priority_suggestion,
          solutions_attempted: escalationData.solutions_attempted,
        },
      })
    }

    // Apply user edits for final ticket creation
    const finalSubject = user_edits?.subject || escalationData.subject
    const finalSummary = user_edits?.description || escalationData.summary
    const finalDescription = buildTicketDescription(
      finalSummary,
      escalationData.solutions_attempted,
      session_id
    )

    // Get default status for new tickets
    const defaultStatus = await queryOne<{ id: string }>(
      `SELECT id FROM ticket_statuses
       WHERE organization_id = $1 AND is_default = true
       LIMIT 1`,
      [orgId]
    )

    // Get the user's contact_id for the ticket
    const userContact = await queryOne<{ contact_id: string | null }>(
      `SELECT contact_id FROM users WHERE id = $1`,
      [userId]
    )

    // Create the ticket
    const ticket = await queryOne<{
      id: string
      ticket_number: number
      prefix: string
    }>(
      `INSERT INTO tickets (
        organization_id, subject, description, priority,
        status_id, contact_id, created_by, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ai_chat')
      RETURNING id, ticket_number, prefix`,
      [
        orgId,
        finalSubject.slice(0, 500),
        finalDescription,
        escalationData.priority_suggestion,
        defaultStatus?.id || null,
        userContact?.contact_id || null,
        userId,
      ]
    )

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Failed to create ticket' },
        { status: 500 }
      )
    }

    // Create chat_ticket_conversions row
    await query(
      `INSERT INTO chat_ticket_conversions (session_id, ticket_id, created_by, ai_suggested_fields, user_modified_fields)
       VALUES ($1, $2, 'user_requested', $3, $4)`,
      [
        session_id,
        ticket.id,
        JSON.stringify({
          subject: escalationData.subject,
          summary: escalationData.summary,
          category_suggestion: escalationData.category_suggestion,
          priority_suggestion: escalationData.priority_suggestion,
          solutions_attempted: escalationData.solutions_attempted,
        }),
        user_edits ? JSON.stringify(user_edits) : null,
      ]
    )

    // Update session: mark as ticket_created, link ticket
    await query(
      `UPDATE ai_chat_sessions
       SET resolution_status = 'ticket_created',
           created_ticket_id = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [ticket.id, session_id]
    )

    const ticketNumber = `${ticket.prefix}-${ticket.ticket_number}`

    return NextResponse.json({
      success: true,
      data: {
        ticket_id: ticket.id,
        ticket_number: ticketNumber,
        subject: finalSubject,
        summary: finalSummary,
      },
    })
  } catch (error) {
    console.error('[AI Escalate] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to escalate chat to ticket' },
      { status: 500 }
    )
  }
}

/**
 * Build a structured markdown ticket description.
 */
function buildTicketDescription(
  summary: string,
  solutionsAttempted: string[],
  sessionId: string
): string {
  const sections: string[] = []

  sections.push('## Issue Summary\n')
  sections.push(summary)
  sections.push('')

  if (solutionsAttempted.length > 0) {
    sections.push('## Solutions Already Attempted\n')
    for (const solution of solutionsAttempted) {
      sections.push(`- ${solution}`)
    }
    sections.push('')
  }

  sections.push('## Chat Reference\n')
  sections.push(`[View original chat session](/portal/chat?session=${sessionId})`)
  sections.push('')

  sections.push('---')
  sections.push('*Auto-generated by Aegis AI*')

  return sections.join('\n')
}

/**
 * Generate an escalation summary using the configured AI provider.
 * Falls back to basic extraction if AI is unavailable or fails.
 */
async function generateEscalationSummary(
  orgId: string,
  transcript: string
): Promise<z.infer<typeof EscalationSummarySchema>> {
  try {
    // Get active AI provider
    const providers = await query<AIProvider>(
      `SELECT id, provider_type, api_url, api_key_encrypted, is_local
       FROM ai_providers
       WHERE organization_id = $1 AND is_active = true
       ORDER BY is_default DESC, created_at DESC
       LIMIT 1`,
      [orgId]
    )

    if (providers.length === 0) {
      return fallbackSummary(transcript)
    }

    const provider = providers[0]

    // Get default model
    const models = await query<AIModel>(
      `SELECT model_name, temperature, max_tokens
       FROM ai_models
       WHERE provider_id = $1 AND is_active = true
       ORDER BY is_default DESC
       LIMIT 1`,
      [provider.id]
    )

    const model = models[0] || {
      model_name: provider.is_local ? 'llama3.2' : 'gpt-3.5-turbo',
      temperature: 0.3,
      max_tokens: 1000,
    }

    // Call AI with the escalation prompt + transcript
    const fullPrompt = ESCALATION_SUMMARY_PROMPT + transcript
    let responseText: string

    switch (provider.provider_type) {
      case 'ollama': {
        const res = await fetch(`${provider.api_url}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model.model_name,
            messages: [{ role: 'user', content: fullPrompt }],
            stream: false,
            options: { temperature: 0.3 },
          }),
        })
        const data = await res.json()
        responseText = data.message?.content || ''
        break
      }
      case 'google': {
        const key = provider.api_key_encrypted || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
        if (!key) {
          return fallbackSummary(transcript)
        }
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
            }),
          }
        )
        const data = await res.json()
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        break
      }
      default: {
        // OpenAI-compatible
        const res = await fetch(`${provider.api_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.api_key_encrypted || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model.model_name,
            messages: [{ role: 'user', content: fullPrompt }],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        })
        const data = await res.json()
        responseText = data.choices?.[0]?.message?.content || ''
        break
      }
    }

    // Parse AI response as JSON
    return parseEscalationResponse(responseText, transcript)
  } catch (error) {
    console.error('[AI Escalate] Summary generation failed:', error)
    return fallbackSummary(transcript)
  }
}

/**
 * Parse AI response text into a validated escalation summary.
 * Falls back to basic extraction if JSON parsing fails.
 */
function parseEscalationResponse(
  responseText: string,
  transcript: string
): z.infer<typeof EscalationSummarySchema> {
  try {
    // Strip markdown code fences if the AI wrapped them
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    const parsed = JSON.parse(cleaned)
    const result = EscalationSummarySchema.safeParse(parsed)

    if (result.success) {
      return result.data
    }

    console.warn('[AI Escalate] Zod validation failed, using partial data:', result.error)
    // Try to extract what we can from the parsed object
    return {
      subject: String(parsed.subject || '').slice(0, 100) || 'Support request from AI chat',
      summary: String(parsed.summary || parsed.description || ''),
      category_suggestion: 'other',
      priority_suggestion: 'medium',
      solutions_attempted: Array.isArray(parsed.solutions_attempted)
        ? parsed.solutions_attempted.map(String)
        : [],
    }
  } catch {
    console.warn('[AI Escalate] Failed to parse AI JSON response, using fallback')
    return fallbackSummary(transcript)
  }
}

/**
 * Fallback summary when AI is unavailable or returns invalid data.
 * Extracts basic info from the conversation transcript.
 */
function fallbackSummary(transcript: string): z.infer<typeof EscalationSummarySchema> {
  // Extract user messages from the transcript
  const userLines = transcript
    .split('\n\n')
    .filter(line => line.startsWith('User:'))
    .map(line => line.replace(/^User:\s*/, ''))

  const firstUserMessage = userLines[0] || 'Support request from AI chat'
  const subject = firstUserMessage.split(/[.!?\n]/)[0].slice(0, 100)

  return {
    subject: subject || 'Support request from AI chat',
    summary: userLines.join('\n\n').slice(0, 2000),
    category_suggestion: 'other',
    priority_suggestion: 'medium',
    solutions_attempted: [],
  }
}

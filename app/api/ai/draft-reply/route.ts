import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { determineAccessContext, getSecurityContextMessage } from '@/lib/ai-chat-security'
import { buildAIContext } from '@/lib/ai-context'
import { getDraftReplyPrompt, suggestIntent, DRAFT_INTENTS, type DraftIntent } from '@/lib/draft-reply-prompts'

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

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session, userId, orgId } = ctx

    // Check feature flag
    const featureCheck = await queryOne<{ enabled: boolean }>(
      `SELECT enabled FROM organization_feature_flags
       WHERE organization_id = $1 AND feature_key = 'ai_draft_reply'`,
      [orgId]
    )

    if (!featureCheck?.enabled) {
      return NextResponse.json(
        { error: 'AI Draft Reply is not enabled. Enable it in Settings > Features.' },
        { status: 403 }
      )
    }

    // Check access context — must be technician or higher (in-org only;
    // cross-org/MSP draft-reply needs explicit grant, not implicit)
    const accessContext = await determineAccessContext(userId, orgId)
    if (accessContext.crossOrg || accessContext.depth === 'end_user') {
      return NextResponse.json(
        { error: 'Insufficient permissions. AI Draft Reply requires technician access or higher.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ticket_id, intent } = body

    if (!ticket_id || typeof ticket_id !== 'string') {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 })
    }
    if (!intent || !DRAFT_INTENTS.includes(intent as DraftIntent)) {
      return NextResponse.json(
        { error: `intent must be one of: ${DRAFT_INTENTS.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch ticket with full context
    const ticket = await queryOne<{
      id: string
      organization_id: string
      ticket_number: number
      prefix: string
      subject: string
      description: string
      priority: string
      status_name: string
      category_name: string | null
      type_name: string | null
      contact_name: string | null
      contact_email: string | null
      company_name: string | null
      assigned_name: string | null
      scheduled_for: Date | null
      action_date_type: string | null
      scheduling_active_from: Date | null
      is_scheduled: boolean
    }>(
      `SELECT
        t.id, t.organization_id, t.ticket_number,
        COALESCE(t.prefix, 'TKT') as prefix,
        t.subject, COALESCE(t.description, '') as description,
        COALESCE(t.priority, 'medium') as priority,
        ts.name as status_name,
        tc.name as category_name,
        tt.name as type_name,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        c.email as contact_email,
        cl.name as company_name,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_name,
        t.scheduled_for, t.action_date_type, t.scheduling_active_from,
        COALESCE(t.is_scheduled, false) as is_scheduled
      FROM tickets t
      JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      LEFT JOIN ticket_types tt ON t.type_id = tt.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN companies cl ON c.company_id = cl.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1 AND t.organization_id = $2`,
      [ticket_id, orgId]
    )

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Fetch last 10 replies (newest first, public only)
    const replies = await query<{
      content: string
      created_at: Date
      user_id: string | null
      contact_id: string | null
      user_name: string | null
      contact_name: string | null
    }>(
      `SELECT r.content, r.created_at,
              r.user_id, r.contact_id,
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(c.first_name, ' ', c.last_name) as contact_name
       FROM ticket_replies r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN contacts c ON r.contact_id = c.id
       WHERE r.ticket_id = $1 AND r.is_internal = false
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [ticket_id]
    )

    const replyContext = replies.map(r => ({
      role: r.contact_id ? 'requester' : 'technician',
      content: r.content,
      createdAt: r.created_at.toISOString(),
    }))

    // Get triage action state for intent suggestion
    const triageScore = await queryOne<{ action_state: string }>(
      `SELECT action_state FROM ticket_queue_scores WHERE ticket_id = $1`,
      [ticket_id]
    )
    const suggestedIntent = suggestIntent(triageScore?.action_state || null)

    // Build AI context (KB search based on ticket subject)
    const aiContext = await buildAIContext({
      query: ticket.subject + ' ' + ticket.description.slice(0, 200),
      organizationId: orgId,
      accessContext,
      userId,
    })

    // Get AI settings
    const aiSettings = await queryOne<{ response_mode: 'strict' | 'balanced' | 'open' }>(
      'SELECT response_mode FROM ai_settings WHERE organization_id = $1',
      [orgId]
    )
    const responseMode = aiSettings?.response_mode || 'balanced'

    // Build the prompt
    const now = new Date()
    const isActionable = !ticket.is_scheduled || !ticket.scheduling_active_from || ticket.scheduling_active_from <= now

    const ticketContext = {
      ticketNumber: `${ticket.prefix}-${ticket.ticket_number}`,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status_name,
      category: ticket.category_name,
      typeName: ticket.type_name,
      contactName: ticket.contact_name?.trim() || null,
      contactEmail: ticket.contact_email,
      companyName: ticket.company_name,
      assignedName: ticket.assigned_name?.trim() || null,
      scheduledFor: ticket.scheduled_for?.toISOString() || null,
      actionDateType: ticket.action_date_type,
      isActionable,
      replies: replyContext,
    }

    // Apply token budget to KB context
    const MAX_SYSTEM_TOKENS = 6000
    const securityContext = getSecurityContextMessage(accessContext)
    const draftPrompt = getDraftReplyPrompt(
      intent as DraftIntent,
      ticketContext,
      responseMode,
      aiContext.systemContextBlock,
    )

    const promptWithSecurity = securityContext + '\n\n' + draftPrompt

    // Truncate if needed
    const estimatedTokens = Math.ceil(promptWithSecurity.length / 4)
    let finalPrompt = promptWithSecurity
    if (estimatedTokens > MAX_SYSTEM_TOKENS) {
      const maxChars = MAX_SYSTEM_TOKENS * 4
      finalPrompt = promptWithSecurity.slice(0, maxChars)
      const lastNewline = finalPrompt.lastIndexOf('\n')
      if (lastNewline > maxChars * 0.5) {
        finalPrompt = finalPrompt.slice(0, lastNewline)
      }
    }

    // Get AI provider
    const providers = await query<AIProvider>(
      `SELECT id, provider_type, api_url, api_key_encrypted, is_local
       FROM ai_providers
       WHERE organization_id = $1 AND is_active = true
       ORDER BY is_default DESC, created_at DESC
       LIMIT 1`,
      [orgId]
    )

    if (providers.length === 0) {
      return NextResponse.json(
        { error: 'No AI provider configured. Go to Settings > AI to add one.' },
        { status: 400 }
      )
    }

    const provider = providers[0]
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
      temperature: 0.7,
      max_tokens: 2000,
    }

    // Call AI provider
    let draftText: string
    let modelUsed: string

    const temperature = parseFloat(String(model.temperature)) || 0.7
    const maxTokens = parseInt(String(model.max_tokens)) || 2000

    switch (provider.provider_type) {
      case 'ollama':
        draftText = await callProvider(provider.api_url, null, model.model_name, finalPrompt, temperature, maxTokens, 'ollama')
        modelUsed = model.model_name
        break
      case 'google':
        draftText = await callProvider(provider.api_url, provider.api_key_encrypted, 'gemini-2.0-flash', finalPrompt, temperature, maxTokens, 'google')
        modelUsed = 'gemini-2.0-flash'
        break
      default:
        draftText = await callProvider(provider.api_url, provider.api_key_encrypted, model.model_name, finalPrompt, temperature, maxTokens, 'openai')
        modelUsed = model.model_name
        break
    }

    const sources = aiContext.sources.map(s => ({
      title: s.title,
      type: s.type,
      url: s.url,
    }))

    return NextResponse.json({
      success: true,
      data: {
        draft: draftText,
        intent,
        sources,
        model: modelUsed,
        suggested_intent: suggestedIntent,
      },
    })
  } catch (error) {
    console.error('[AI Draft Reply] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate draft reply' },
      { status: 500 }
    )
  }
}

async function callProvider(
  apiUrl: string,
  apiKey: string | null,
  modelName: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
  type: 'ollama' | 'openai' | 'google',
): Promise<string> {
  if (type === 'ollama') {
    const response = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature },
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
    const data = await response.json()
    return data.message?.content || ''
  }

  if (type === 'google') {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
    if (!key) throw new Error('Gemini API key not configured')

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
        signal: AbortSignal.timeout(60000),
      }
    )
    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)
    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  // OpenAI / OpenAI-compatible
  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

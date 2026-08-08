import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { query } from '@/lib/db'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SUMMARIZE_PROMPT = `You are generating a support ticket from an AI chat conversation where the AI could not fully resolve the user's issue.

Given the conversation below, produce a JSON object with two fields:
1. "subject": A concise ticket subject line (max 120 chars) that clearly states the issue. Write it as if a technician is scanning a queue — be specific, not vague.
2. "description": A structured handoff summary for the support team. Include:
   - **Issue**: What the user is experiencing (in their words, paraphrased)
   - **What was tried**: What the AI assistant suggested or what the user already attempted
   - **Current state**: Where things stand now — what still needs resolution
   - **User context**: Any relevant details the user mentioned (device, software, error messages, etc.)

Keep the description under 500 words. Use plain text with markdown headers. Do NOT include greetings or sign-offs.

Return ONLY the raw JSON object, no markdown code fences, no extra text.`

// Helper to get the default organization ID
async function getOrgId(): Promise<string> {
  const orgs = await query<{ id: string }>(
    `SELECT id FROM organizations LIMIT 1`
  )
  return orgs[0]?.id || ''
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { messages } = body as { messages: ChatMessage[] }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Conversation messages are required' },
        { status: 400 }
      )
    }

    const orgId = await getOrgId()

    // Build the conversation transcript for the AI
    const transcript = messages
      .map(m => `${m.role === 'user' ? 'User' : 'AI Assistant'}: ${m.content}`)
      .join('\n\n')

    const summarizeMessage = `${SUMMARIZE_PROMPT}\n\n---\n\nConversation:\n\n${transcript}`

    // Get AI provider (same logic as chat route)
    const providers = await query<{
      id: string
      provider_type: string
      api_url: string
      api_key_encrypted: string | null
      is_local: boolean
    }>(
      `SELECT id, provider_type, api_url, api_key_encrypted, is_local
       FROM ai_providers
       WHERE organization_id = $1 AND is_active = true
       ORDER BY is_default DESC, created_at DESC
       LIMIT 1`,
      [orgId]
    )

    const models = providers.length > 0
      ? await query<{ model_name: string; temperature: number; max_tokens: number }>(
          `SELECT model_name, temperature, max_tokens
           FROM ai_models
           WHERE provider_id = $1 AND is_active = true
           ORDER BY is_default DESC
           LIMIT 1`,
          [providers[0].id]
        )
      : []

    let responseText = ''

    if (providers.length > 0) {
      const provider = providers[0]
      const model = models[0] || {
        model_name: provider.is_local ? 'llama3.2' : 'gpt-3.5-turbo',
        temperature: 0.3,
        max_tokens: 1000,
      }

      responseText = await callProvider(
        provider.provider_type,
        provider.api_url,
        provider.api_key_encrypted || '',
        model.model_name,
        summarizeMessage,
        0.3, // Low temperature for factual summary
        1000
      )
    } else {
      // No AI provider configured — fall back to basic extraction
      return NextResponse.json(fallbackSummary(messages))
    }

    // Parse the JSON response
    try {
      // Strip markdown code fences if the AI wrapped them
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()
      const parsed = JSON.parse(cleaned)
      // Ensure description is always a string (AI may return nested objects)
      let desc = parsed.description || ''
      if (typeof desc !== 'string') {
        desc = JSON.stringify(desc, null, 2)
      }
      return NextResponse.json({
        subject: String(parsed.subject || '').slice(0, 120),
        description: desc,
      })
    } catch {
      // AI didn't return valid JSON — extract what we can
      return NextResponse.json(fallbackSummary(messages))
    }
  } catch (error) {
    console.error('Escalation summary error:', error)
    return NextResponse.json(fallbackSummary([]))
  }
}

/**
 * Fallback when AI is unavailable: extract the best subject/description
 * from the conversation without AI help.
 */
function fallbackSummary(messages: ChatMessage[]) {
  const userMessages = messages.filter(m => m.role === 'user')
  const aiMessages = messages.filter(m => m.role === 'assistant')

  // Subject: first user message, trimmed to a sentence
  const firstUserMsg = userMessages[0]?.content || 'Support request from AI chat'
  const subject = firstUserMsg.split(/[.!?\n]/)[0].slice(0, 120)

  // Description: structured from the conversation
  const userParts = userMessages.map(m => m.content).join('\n')
  const aiParts = aiMessages.map(m => m.content).join('\n')

  const description = [
    '**Issue**',
    userParts.slice(0, 500),
    '',
    '**What was discussed with AI**',
    aiParts.slice(0, 500),
    '',
    '*This ticket was escalated from AI chat because the assistant could not fully resolve the issue.*',
  ].join('\n')

  return { subject, description }
}

async function callProvider(
  providerType: string,
  apiUrl: string,
  apiKey: string,
  modelName: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  if (providerType === 'ollama') {
    const res = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature },
      }),
    })
    const data = await res.json()
    return data.message?.content || ''
  }

  // OpenAI-compatible (including openai, anthropic-compatible, etc.)
  const res = await fetch(`${apiUrl}/chat/completions`, {
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
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
      }),
    }
  )
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

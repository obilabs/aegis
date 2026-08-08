/**
 * AI-Powered Triage Classification
 *
 * Calls the configured AI provider to classify a ticket's action state.
 * Falls back to heuristic classification if no AI provider is available
 * or if the AI call fails.
 *
 * Only classifies tickets in `open` base_status — pending/closed statuses
 * are deterministic and handled by the heuristic classifier in triage.ts.
 */

import { query, queryOne } from './db'
import type { ActionState, ReplyInfo, TriageResult } from './triage'
import { ACTION_STATES, classifyActionStateHeuristic } from './triage'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIProvider {
  id: string
  providerType: string
  apiUrl: string
  apiKey: string | null
  isLocal: boolean
}

interface AIModel {
  modelName: string
  temperature: number
  maxTokens: number
}

interface AITriageResponse {
  action_state: string
  confidence: number
  reasoning: string
  suggested_status: string | null
  sla_should_pause: boolean
}

export interface AITriageResult extends TriageResult {
  suggestedStatus: string | null
  slaShoulPause: boolean
  model: string
  provider: string
}

// ─── Provider Resolution ─────────────────────────────────────────────────────

async function getActiveProvider(organizationId: string): Promise<AIProvider | null> {
  const row = await queryOne<{
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
    [organizationId]
  )

  if (!row) return null

  return {
    id: row.id,
    providerType: row.provider_type,
    apiUrl: row.api_url,
    apiKey: row.api_key_encrypted,
    isLocal: row.is_local,
  }
}

async function getModelForProvider(providerId: string): Promise<AIModel> {
  const row = await queryOne<{
    model_name: string
    temperature: number
    max_tokens: number
  }>(
    `SELECT model_name, temperature, max_tokens
     FROM ai_models
     WHERE provider_id = $1 AND is_active = true
     ORDER BY is_default DESC
     LIMIT 1`,
    [providerId]
  )

  return row
    ? { modelName: row.model_name, temperature: row.temperature, maxTokens: row.max_tokens }
    : { modelName: 'llama3.2', temperature: 0.3, maxTokens: 500 }
}

// ─── Prompt Building ─────────────────────────────────────────────────────────

interface TicketContext {
  prefix: string
  ticketNumber: number
  subject: string
  statusName: string
  priority: string
  assignedAgentName: string | null
  createdAt: Date
  replies: { role: string; timestamp: Date; content: string }[]
}

function buildTriagePrompt(ctx: TicketContext): string {
  const repliesText = ctx.replies.length > 0
    ? ctx.replies
        .map(
          (r) =>
            `[${r.role}] [${r.timestamp.toISOString()}] ${r.content.slice(0, 500)}`
        )
        .join('\n---\n')
    : '(no replies yet)'

  return `You are a helpdesk triage analyst. Analyze the most recent activity on this
support ticket and classify what action is needed next.

Ticket: ${ctx.prefix}-${ctx.ticketNumber}
Subject: ${ctx.subject}
Current status: ${ctx.statusName}
Priority: ${ctx.priority}
Assigned to: ${ctx.assignedAgentName || 'Unassigned'}
Created: ${ctx.createdAt.toISOString()}
Last 5 replies (newest first):
---
${repliesText}
---

Classify into exactly ONE action state:
- new_unreviewed: New ticket that no agent has reviewed yet
- needs_agent_action: The support agent needs to respond or take action NOW
- needs_more_info: Not enough information to work on — agent should ask for details
- escalation_needed: This needs someone with more expertise, access, or authority
- waiting_on_user: Agent asked a question, waiting for user to respond
- user_will_follow_up: User explicitly said they'll get back later
- waiting_on_vendor: Waiting for an external vendor, supplier, or third party
- waiting_on_internal: Waiting for another internal team or colleague
- waiting_on_approval: A formal approval is pending
- waiting_on_parts: Hardware, parts, or equipment ordered, awaiting delivery
- scheduled: Work explicitly planned for a specific future date
- on_hold: Paused for a reason not covered above
- resolution_candidate: Issue appears resolved, user thanked agent, or fix was applied

Respond in JSON only (no markdown, no extra text):
{
  "action_state": "...",
  "confidence": 0.0-1.0,
  "reasoning": "One sentence explaining your classification",
  "suggested_status": "Status name if current status should change, or null",
  "sla_should_pause": true/false
}`
}

// ─── Provider Call Functions ─────────────────────────────────────────────────

async function callOllama(
  apiUrl: string,
  modelName: string,
  prompt: string,
  temperature: number
): Promise<string> {
  const response = await fetch(`${apiUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature },
      format: 'json',
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.message?.content || ''
}

async function callOpenAI(
  apiUrl: string,
  apiKey: string,
  modelName: string,
  prompt: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callGemini(
  apiKey: string,
  prompt: string
): Promise<string> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  if (!key) throw new Error('No Gemini API key available')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── Response Parsing ────────────────────────────────────────────────────────

function parseAIResponse(raw: string): AITriageResponse | null {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(cleaned)

    // Validate action_state
    if (!parsed.action_state || !ACTION_STATES.includes(parsed.action_state)) {
      return null
    }

    return {
      action_state: parsed.action_state,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      reasoning: String(parsed.reasoning || ''),
      suggested_status: parsed.suggested_status || null,
      sla_should_pause: Boolean(parsed.sla_should_pause),
    }
  } catch {
    return null
  }
}

// ─── Main Classification Function ────────────────────────────────────────────

/**
 * Classify a ticket's action state using AI.
 * Returns null if no AI provider is configured or the call fails.
 */
export async function classifyActionStateAI(
  ticketId: string,
  organizationId: string
): Promise<AITriageResult | null> {
  // Fetch provider
  const provider = await getActiveProvider(organizationId)

  if (!provider) return null

  // Fetch ticket context for prompt
  const ticket = await queryOne<{
    prefix: string
    ticket_number: number
    subject: string
    priority: string
    status_name: string
    assigned_agent_name: string | null
    created_at: Date
  }>(
    `SELECT
      COALESCE(t.prefix, 'TKT') as prefix,
      t.ticket_number,
      t.subject,
      COALESCE(t.priority, 'medium') as priority,
      ts.name as status_name,
      CONCAT(u.first_name, ' ', u.last_name) as assigned_agent_name,
      t.created_at
    FROM tickets t
    JOIN ticket_statuses ts ON t.status_id = ts.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.id = $1`,
    [ticketId]
  )

  if (!ticket) return null

  // Fetch last 5 replies
  const replies = await query<{
    user_id: string | null
    contact_id: string | null
    content: string
    created_at: Date
    first_name: string | null
    contact_name: string | null
  }>(
    `SELECT
      r.user_id, r.contact_id, r.content, r.created_at,
      u.first_name,
      c.first_name as contact_name
    FROM ticket_replies r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN contacts c ON r.contact_id = c.id
    WHERE r.ticket_id = $1 AND r.is_internal = false
    ORDER BY r.created_at DESC
    LIMIT 5`,
    [ticketId]
  )

  const replyContext = replies.map((r) => ({
    role: r.contact_id ? 'user' : 'agent',
    timestamp: r.created_at,
    content: r.content,
  }))

  const prompt = buildTriagePrompt({
    prefix: ticket.prefix,
    ticketNumber: ticket.ticket_number,
    subject: ticket.subject,
    statusName: ticket.status_name,
    priority: ticket.priority,
    assignedAgentName: ticket.assigned_agent_name,
    createdAt: ticket.created_at,
    replies: replyContext,
  })

  // Call AI provider
  let rawResponse: string
  let modelUsed: string
  let providerUsed: string

  try {
    if (provider) {
      const model = await getModelForProvider(provider.id)
      modelUsed = model.modelName
      providerUsed = provider.providerType

      switch (provider.providerType) {
        case 'ollama':
          rawResponse = await callOllama(provider.apiUrl, model.modelName, prompt, 0.3)
          break
        case 'openai':
          rawResponse = await callOpenAI(
            provider.apiUrl,
            provider.apiKey || '',
            model.modelName,
            prompt,
            0.3,
            500
          )
          break
        case 'google':
          rawResponse = await callGemini(provider.apiKey || '', prompt)
          break
        default:
          // OpenAI-compatible fallback
          rawResponse = await callOpenAI(
            provider.apiUrl,
            provider.apiKey || '',
            model.modelName,
            prompt,
            0.3,
            500
          )
          providerUsed = 'openai-compatible'
          break
      }
    } else {
      return null // No provider configured
    }
  } catch (err) {
    console.error('[triage-ai] Provider call failed:', err)
    return null
  }

  // Parse response
  const parsed = parseAIResponse(rawResponse)
  if (!parsed) {
    console.warn('[triage-ai] Failed to parse AI response:', rawResponse.slice(0, 200))
    return null
  }

  return {
    actionState: parsed.action_state as ActionState,
    confidence: parsed.confidence,
    reasoning: `AI (${providerUsed}): ${parsed.reasoning}`,
    suggestedStatus: parsed.suggested_status,
    slaShoulPause: parsed.sla_should_pause,
    model: modelUsed!,
    provider: providerUsed!,
  }
}

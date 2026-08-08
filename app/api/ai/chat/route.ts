import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { query, queryOne } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { SUPPORT_SYSTEM_PROMPT, generateTitlePrompt, getStrictnessPrompt, getUserContextBlock } from '@/lib/support-prompt'
import { getUserPermissions } from '@/lib/permissions'
import { buildAIContext } from '@/lib/ai-context'
import {
  determineAccessContext,
  createSecureChatSession,
  getSecurityContextMessage,
  accessContextFromLegacy,
  type LegacyContextLevel,
} from '@/lib/ai-chat-security'
import type { AccessContext, DepthLevel } from '@/lib/access-context'
import { validateApiRequest } from '@/lib/api-auth'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AIProvider {
  id: string
  name: string
  provider_type: string
  api_url: string
  api_key_encrypted: string | null
  is_local: boolean
}

interface AIModel {
  model_name: string
  system_prompt: string | null
  temperature: number
  max_tokens: number
}

interface Source {
  title: string
  type: string
  url: string
}

/**
 * Authenticate via session cookie or API key.
 * Returns user context or an error response.
 */
async function authenticateChat(request: NextRequest): Promise<
  | { userId: string; orgId: string; accessContext: AccessContext; contactId: string | null; apiKeyId?: string }
  | NextResponse
> {
  // Try session auth first
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    const orgId = await getOrgId()
    const appUserId = await getUserId(session.user.email)
    const accessContext = await determineAccessContext(appUserId, orgId)

    // Get linked contact ID
    const userContact = await queryOne<{ contact_id: string | null }>(
      'SELECT contact_id FROM users WHERE id = $1',
      [appUserId]
    )

    return {
      userId: appUserId,
      orgId,
      accessContext,
      contactId: userContact?.contact_id || null,
    }
  }

  // Fall back to API key auth
  const apiResult = await validateApiRequest(request)
  if (apiResult instanceof NextResponse) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // When auth is via API key, the effective AccessContext is clamped:
  // depth = min(key.depth, user.depth); crossOrg = key.crossOrg OR user.crossOrg
  // (a provider key forces crossOrg true even for an in-org user; a non-cross
  // user can never lift a provider key out of crossOrg).
  const userAc = await determineAccessContext(apiResult.userId, apiResult.orgId)

  let keyAc: AccessContext = { depth: 'end_user', crossOrg: false }
  if (apiResult.keyId) {
    const keyRow = await queryOne<{ ai_context_level: string }>(
      'SELECT ai_context_level FROM api_keys WHERE id = $1',
      [apiResult.keyId]
    )
    if (keyRow?.ai_context_level) {
      keyAc = accessContextFromLegacy(keyRow.ai_context_level as LegacyContextLevel)
    }
  }

  const accessContext = clampAccessContext(keyAc, userAc)

  // Get linked contact ID
  const userContact = await queryOne<{ contact_id: string | null }>(
    'SELECT contact_id FROM users WHERE id = $1',
    [apiResult.userId]
  )

  return {
    userId: apiResult.userId,
    orgId: apiResult.orgId,
    accessContext,
    contactId: userContact?.contact_id || null,
    apiKeyId: apiResult.keyId,
  }
}

/**
 * Clamp two AccessContexts to the more restrictive: depth uses min, crossOrg
 * propagates (OR) so a provider key cannot be neutralized by an in-org user.
 */
const DEPTH_ORDER: DepthLevel[] = ['end_user', 'technician', 'admin']

function clampAccessContext(a: AccessContext, b: AccessContext): AccessContext {
  const aIdx = DEPTH_ORDER.indexOf(a.depth)
  const bIdx = DEPTH_ORDER.indexOf(b.depth)
  const depth = aIdx <= bIdx ? a.depth : b.depth
  const crossOrg = a.crossOrg || b.crossOrg
  return { depth, crossOrg }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate (session or API key)
    const authResult = await authenticateChat(request)
    if (authResult instanceof NextResponse) return authResult

    const { userId, orgId, accessContext, contactId, apiKeyId } = authResult

    const body = await request.json()
    const { message, history = [], session_id } = body

    if (!message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Check if AI chat feature is enabled
    const featureCheck = await query<{ enabled: boolean }>(
      `SELECT enabled FROM organization_feature_flags
       WHERE organization_id = $1 AND feature_key = 'ai_chat'`,
      [orgId]
    )
    if (featureCheck.length === 0 || !featureCheck[0].enabled) {
      return NextResponse.json(
        { success: false, error: 'AI Chat is not enabled. Enable it in Settings > Features.' },
        { status: 403 }
      )
    }

    // Resolve or create chat session
    let chatSessionId: string
    let isNewSession = false

    if (session_id) {
      // Resume existing session — validate ownership
      const existingSession = await queryOne<{ id: string; user_id: string; organization_id: string }>(
        `SELECT id, user_id, organization_id FROM ai_chat_sessions
         WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
        [session_id, orgId]
      )
      if (!existingSession) {
        return NextResponse.json(
          { success: false, error: 'Session not found or not active' },
          { status: 404 }
        )
      }
      if (existingSession.user_id && existingSession.user_id !== userId) {
        return NextResponse.json(
          { success: false, error: 'Session does not belong to this user' },
          { status: 403 }
        )
      }
      chatSessionId = existingSession.id
    } else {
      // Create new secure session with role-appropriate chat type
      const chatType = (accessContext.depth === 'admin' || accessContext.depth === 'technician')
        ? 'admin_support' as const : 'user_support' as const
      const newSession = await createSecureChatSession(
        orgId,
        userId,
        contactId,
        chatType,
      )
      chatSessionId = newSession.id
      isNewSession = true
    }

    // Persist user message
    await query(
      `INSERT INTO ai_chat_messages (session_id, role, content, message_type)
       VALUES ($1, 'user', $2, 'text')`,
      [chatSessionId, message.trim()]
    )

    // Update session timestamp
    await query(
      `UPDATE ai_chat_sessions SET updated_at = NOW() WHERE id = $1`,
      [chatSessionId]
    )

    // Fetch org AI settings (response_mode for strictness)
    const aiSettings = await queryOne<{
      response_mode: 'strict' | 'balanced' | 'open'
      auto_draft_threshold: number
    }>(
      'SELECT response_mode, auto_draft_threshold FROM ai_settings WHERE organization_id = $1',
      [orgId]
    )
    const responseMode = aiSettings?.response_mode || 'balanced'

    // Build AI context using hybrid search (FTS + vector when available)
    const aiContext = await buildAIContext({
      query: message.trim(),
      organizationId: orgId,
      accessContext,
      sessionId: chatSessionId,
      userId,
      contactId: contactId || undefined,
    })

    const sources: Source[] = aiContext.sources.map(s => ({
      title: s.title,
      type: s.type,
      url: s.url,
    }))

    const kbResultsCount = aiContext.searchMetrics.hybridResults

    // Get active AI provider
    const providers = await query<AIProvider>(
      `SELECT id, name, provider_type, api_url, api_key_encrypted, is_local
       FROM ai_providers
       WHERE organization_id = $1 AND is_active = true
       ORDER BY is_default DESC, created_at DESC
       LIMIT 1`,
      [orgId]
    )

    if (providers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No AI provider configured. Go to Settings -> AI to add one.' },
        { status: 400 }
      )
    }

    const provider = providers[0]

    // Get default model for this provider
    const models = await query<AIModel>(
      `SELECT model_name, system_prompt, temperature, max_tokens
       FROM ai_models
       WHERE provider_id = $1 AND is_active = true
       ORDER BY is_default DESC
       LIMIT 1`,
      [provider.id]
    )

    const model = models[0] || {
      model_name: provider.is_local ? 'llama3.2' : 'gpt-3.5-turbo',
      system_prompt: null,
      temperature: 0.7,
      max_tokens: 2000,
    }

    // Build system prompt: base → user context → security context → strictness mode → KB articles context
    const basePrompt = model.system_prompt || SUPPORT_SYSTEM_PROMPT
    const permissions = await getUserPermissions(userId)
    const userContext = getUserContextBlock(accessContext, permissions.capabilities, permissions.ticketAccess)
    const securityContext = getSecurityContextMessage(accessContext)
    const strictnessPrompt = getStrictnessPrompt(responseMode, accessContext)

    // Phase 7.2: Token limit truncation
    // Estimate tokens (rough: 1 token ≈ 4 chars) and truncate KB context if needed
    const MAX_SYSTEM_PROMPT_TOKENS = 6000
    const corePrompt = basePrompt + '\n' + userContext + '\n' + securityContext + '\n' + strictnessPrompt
    const coreTokenEstimate = Math.ceil(corePrompt.length / 4)
    const remainingTokenBudget = MAX_SYSTEM_PROMPT_TOKENS - coreTokenEstimate

    let kbContextBlock = aiContext.systemContextBlock
    const kbTokenEstimate = Math.ceil(kbContextBlock.length / 4)

    if (kbTokenEstimate > remainingTokenBudget && remainingTokenBudget > 0) {
      // Truncate KB context to fit within budget, preserving the most relevant (first) articles
      const maxKbChars = remainingTokenBudget * 4
      kbContextBlock = kbContextBlock.slice(0, maxKbChars)
      // Trim to the last complete line to avoid cutting mid-article
      const lastNewline = kbContextBlock.lastIndexOf('\n')
      if (lastNewline > maxKbChars * 0.5) {
        kbContextBlock = kbContextBlock.slice(0, lastNewline)
      }
      console.warn(`[AI Chat] System prompt KB context truncated: ${kbTokenEstimate} est. tokens → ${Math.ceil(kbContextBlock.length / 4)} est. tokens (budget: ${remainingTokenBudget})`)
    } else if (remainingTokenBudget <= 0) {
      // Core prompt alone exceeds budget — drop all KB context
      kbContextBlock = ''
      console.warn(`[AI Chat] System prompt core exceeds ${MAX_SYSTEM_PROMPT_TOKENS} token budget (${coreTokenEstimate} est. tokens). KB context dropped entirely.`)
    }

    const systemPrompt = corePrompt + kbContextBlock

    // Ensure temperature is a proper float (database returns Decimal)
    const temperature = parseFloat(String(model.temperature)) || 0.7
    const maxTokens = parseInt(String(model.max_tokens)) || 2000

    // Call AI provider and get response text
    let responseText: string
    let modelUsed: string

    switch (provider.provider_type) {
      case 'ollama':
        responseText = await callOllama(
          provider.api_url, model.model_name, systemPrompt, message, history, temperature
        )
        modelUsed = model.model_name
        break
      case 'openai':
        responseText = await callOpenAI(
          provider.api_url, provider.api_key_encrypted || '', model.model_name,
          systemPrompt, message, history, temperature, maxTokens
        )
        modelUsed = model.model_name
        break
      case 'google':
        responseText = await callGemini(
          message, history, provider.api_key_encrypted || undefined, systemPrompt, model.model_name
        )
        modelUsed = model.model_name
        break
      default:
        // Try OpenAI-compatible API
        responseText = await callOpenAI(
          provider.api_url, provider.api_key_encrypted || '', model.model_name,
          systemPrompt, message, history, temperature, maxTokens
        )
        modelUsed = model.model_name
        break
    }

    // Determine if this is a KB gap
    // Gap = no results found, OR AI response indicates it couldn't find relevant info
    let isKbGap = kbResultsCount === 0
    if (!isKbGap && responseText) {
      const gapPhrases = [
        "i don't have information",
        "not in our knowledge base",
        "no articles",
        "no knowledge base article",
        "i don't have a knowledge base article",
        "don't have a kb article",
        "not covered in",
        "no relevant articles",
        "couldn't find any",
        "i couldn't find information",
        "i was unable to find",
        "i don't have specific information",
      ]
      const lowerResponse = responseText.toLowerCase()
      isKbGap = gapPhrases.some(phrase => lowerResponse.includes(phrase))
    }

    // Persist assistant message with search metadata for gap aggregation
    const sourceIds = aiContext.sources.map(s => s.id)
    await query(
      `INSERT INTO ai_chat_messages (session_id, role, content, model_used, message_type, kb_articles_referenced, kb_gap, metadata)
       VALUES ($1, 'assistant', $2, $3, 'text', $4, $5, $6)`,
      [
        chatSessionId,
        responseText,
        modelUsed,
        sourceIds.length > 0 ? sourceIds : null,
        isKbGap,
        JSON.stringify({
          sources: sources,
          search_metrics: aiContext.searchMetrics,
          search_queries: [message.trim()],
          kb_results_count: kbResultsCount,
          api_key_id: apiKeyId || null,
        }),
      ]
    )

    // Update session timestamp again after response
    await query(
      `UPDATE ai_chat_sessions SET updated_at = NOW() WHERE id = $1`,
      [chatSessionId]
    )

    // Generate session title on first message (fire and forget)
    if (isNewSession) {
      generateSessionTitle(chatSessionId, message.trim(), provider, model).catch(err => {
        console.error('[AI Chat] Title generation failed:', err)
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        response: responseText,
        model: modelUsed,
        provider: provider.provider_type,
        sources,
        session_id: chatSessionId,
        kb_gap: isKbGap,
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process message' },
      { status: 500 }
    )
  }
}

// ============================================================================
// AI Provider Callers (return response text, not NextResponse)
// ============================================================================

async function callOllama(
  apiUrl: string,
  modelName: string,
  systemPrompt: string,
  message: string,
  history: ChatMessage[],
  temperature: number,
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const response = await fetch(`${apiUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages,
      stream: false,
      options: { temperature },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Ollama error:', errorText)
    throw new Error(`Ollama API error: ${response.status}`)
  }

  const data = await response.json()
  return data.message?.content || ''
}

async function callOpenAI(
  apiUrl: string,
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  message: string,
  history: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callGemini(
  message: string,
  history: ChatMessage[],
  apiKey?: string,
  systemPrompt?: string,
  model: string = 'gemini-2.0-flash',
): Promise<string> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY

  if (!key) {
    throw new Error('Gemini API key not configured')
  }

  const contents = [
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt || SUPPORT_SYSTEM_PROMPT }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ============================================================================
// Session Title Generation
// ============================================================================

/**
 * Generate a title for a new chat session using the AI provider.
 * This is a fire-and-forget side-call — failure does not affect the chat.
 */
async function generateSessionTitle(
  sessionId: string,
  firstMessage: string,
  provider: AIProvider,
  model: AIModel,
): Promise<void> {
  try {
    const titlePrompt = generateTitlePrompt(firstMessage)
    let title: string

    switch (provider.provider_type) {
      case 'ollama':
        title = await callOllama(
          provider.api_url, model.model_name, 'You are a helpful assistant.', titlePrompt, [], 0.3
        )
        break
      case 'google':
        title = await callGemini(titlePrompt, [], provider.api_key_encrypted || undefined, 'You are a helpful assistant.')
        break
      default:
        title = await callOpenAI(
          provider.api_url, provider.api_key_encrypted || '', model.model_name,
          'You are a helpful assistant.', titlePrompt, [], 0.3, 50
        )
        break
    }

    // Clean up title: remove quotes, trim, limit length
    title = title.replace(/^["']|["']$/g, '').trim()
    if (!title || title.length < 2) {
      // Fallback: truncate first user message
      title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
    } else if (title.length > 100) {
      title = title.slice(0, 97) + '...'
    }

    await query(
      `UPDATE ai_chat_sessions SET title = $1 WHERE id = $2`,
      [title, sessionId]
    )
  } catch (error) {
    console.error('[AI Chat] Title generation failed, using fallback:', error)
    // Fallback: use truncated first message
    const fallbackTitle = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
    await query(
      `UPDATE ai_chat_sessions SET title = $1 WHERE id = $2`,
      [fallbackTitle, sessionId]
    ).catch(() => {}) // Swallow fallback errors too
  }
}

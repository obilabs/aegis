import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { chat, GeminiError } from '@/lib/gemini'
import { SUPPORT_SYSTEM_PROMPT, getUserContextBlock } from '@/lib/support-prompt'
import { determineAccessContext, getSecurityContextMessage } from '@/lib/ai-chat-security'
import { getUserPermissions } from '@/lib/permissions'

// Rate limit: 20 messages per hour per user
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in ms
const RATE_LIMIT_MAX = 20

// Session expires after 30 minutes of inactivity
const SESSION_EXPIRY_MINUTES = 30

interface SupportConversation {
  id: string
  user_id: string
  title: string
  created_at: Date
  updated_at: Date
}

interface SupportMessage {
  id: string
  conversation_id: string
  role: string
  sender_type: string
  content: string
  created_at: Date
}

export async function POST(request: NextRequest) {
  // Verify authentication
  const ctx = await getAuthContext(request)

  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { userId, orgId } = ctx

  try {
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { success: false, error: 'Message is too long (max 4000 characters)' },
        { status: 400 }
      )
    }

    // Check rate limit
    const rateLimitCheck = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM support_messages
       WHERE conversation_id IN (SELECT id FROM support_conversations WHERE user_id = $1)
       AND sender_type = 'user'
       AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId]
    )

    const messageCount = parseInt(rateLimitCheck[0]?.count || '0', 10)
    if (messageCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait before sending more messages.',
          rate_limit: {
            limit: RATE_LIMIT_MAX,
            remaining: 0,
            reset_in_minutes: 60
          }
        },
        { status: 429 }
      )
    }

    // SINGLE SESSION: Get or create the user's single conversation
    // First, check if user has an active conversation (updated within expiry window)
    let conversation = await queryOne<SupportConversation>(
      `SELECT id, user_id, title, created_at, updated_at
       FROM support_conversations
       WHERE user_id = $1
       AND updated_at > NOW() - INTERVAL '${SESSION_EXPIRY_MINUTES} minutes'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    )

    let conversationId: string
    let isNewSession = false

    if (!conversation) {
      // No active session - create new one and clear old messages
      isNewSession = true

      // Delete old conversations for this user (clean slate)
      await query(
        `DELETE FROM support_conversations WHERE user_id = $1`,
        [userId]
      )

      // Create fresh conversation
      const newConversation = await queryOne<SupportConversation>(
        `INSERT INTO support_conversations (user_id, title, created_at, updated_at)
         VALUES ($1, 'Support Chat', NOW(), NOW())
         RETURNING id, user_id, title, created_at, updated_at`,
        [userId]
      )

      if (!newConversation) {
        throw new Error('Failed to create conversation')
      }

      conversationId = newConversation.id
    } else {
      conversationId = conversation.id
    }

    // Get conversation history (limit to last 20 messages to manage context)
    const historyRows = await query<SupportMessage>(
      `SELECT id, conversation_id, role, sender_type, content, created_at
       FROM support_messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [conversationId]
    )

    // Reverse to get chronological order and convert to chat format
    const history = historyRows.reverse().map((msg) => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      content: msg.content,
    }))

    // Save user message with sender_type
    await query(
      `INSERT INTO support_messages (conversation_id, sender_type, role, content, created_at)
       VALUES ($1, 'user', 'user', $2, NOW())`,
      [conversationId, message.trim()]
    )

    // Get custom system prompt if configured
    let systemPrompt = SUPPORT_SYSTEM_PROMPT
    try {
      const customPrompt = await queryOne<{ value: string }>(
        `SELECT value FROM site_settings WHERE key = 'ai_system_prompt'`
      )
      if (customPrompt?.value && customPrompt.value.trim()) {
        systemPrompt = customPrompt.value
      }
    } catch {
      // Use default prompt if query fails
    }

    // Append role-aware context so the AI tailors responses to this user's capabilities
    const accessContext = await determineAccessContext(userId, orgId)
    const permissions = await getUserPermissions(userId)
    const userContext = getUserContextBlock(accessContext, permissions.capabilities, permissions.ticketAccess)
    const securityContext = getSecurityContextMessage(accessContext)
    systemPrompt = systemPrompt + '\n' + userContext + '\n' + securityContext

    // Get AI response
    let aiResponse: string
    let isOffline = false
    try {
      aiResponse = await chat(systemPrompt, history, message.trim())
    } catch (error) {
      console.error('AI chat error:', error)

      if (error instanceof GeminiError) {
        if (error.type === 'offline') {
          isOffline = true
          aiResponse = "**Support chat is temporarily offline.**\n\nOur AI assistant is currently unavailable. In the meantime, you can:\n\n- Visit our [GitHub repository](https://github.com/obilabs/Aegis) for documentation\n- Check the [README](https://github.com/obilabs/Aegis#readme) for setup help\n- Open an [issue](https://github.com/obilabs/Aegis/issues) for bug reports\n\nPlease try again later!"
        } else if (error.type === 'blocked') {
          aiResponse = "I wasn't able to respond to that message. Please try rephrasing your question."
        } else {
          aiResponse = "I'm having trouble processing your request right now. Please try again in a moment."
        }
      } else {
        aiResponse = "I'm having trouble processing your request right now. Please try again in a moment, or visit our [GitHub repository](https://github.com/obilabs/Aegis) for help."
      }
    }

    // Save AI response with sender_type
    await query(
      `INSERT INTO support_messages (conversation_id, sender_type, role, content, created_at)
       VALUES ($1, 'bot', 'model', $2, NOW())`,
      [conversationId, aiResponse]
    )

    // Update conversation timestamp
    await query(
      `UPDATE support_conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    )

    // Calculate remaining rate limit
    const remainingMessages = RATE_LIMIT_MAX - messageCount - 1

    return NextResponse.json({
      success: true,
      data: {
        conversation_id: conversationId,
        response: aiResponse,
        is_offline: isOffline,
        is_new_session: isNewSession,
        rate_limit: {
          limit: RATE_LIMIT_MAX,
          remaining: Math.max(0, remainingMessages),
          reset_in_minutes: 60
        }
      },
    })
  } catch (error) {
    console.error('Support chat error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process message' },
      { status: 500 }
    )
  }
}

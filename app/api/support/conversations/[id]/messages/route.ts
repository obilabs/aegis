import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

interface SupportMessage {
  id: string
  conversation_id: string
  role: 'user' | 'model'
  content: string
  created_at: Date
}

interface SupportConversation {
  id: string
  user_id: string
  title: string
}

// GET /api/support/conversations/[id]/messages - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)

  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { userId } = ctx
  const { id: conversationId } = await params

  try {
    // Verify conversation belongs to user
    const conversation = await queryOne<SupportConversation>(
      `SELECT id, title FROM support_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    )

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Get all messages
    const messages = await query<SupportMessage>(
      `SELECT id, conversation_id, role, content, created_at
       FROM support_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    )

    return NextResponse.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          title: conversation.title,
        },
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at,
        })),
      },
    })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

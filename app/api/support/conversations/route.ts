import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

interface SupportConversation {
  id: string
  user_id: string
  title: string
  created_at: Date
  updated_at: Date
  last_message?: string
  message_count?: number
}

interface SupportMessage {
  id: string
  conversation_id: string
  role: 'user' | 'model'
  content: string
  created_at: Date
}

// GET /api/support/conversations - List user's conversations
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)

  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { userId } = ctx

  try {
    // Get conversations with last message preview
    const conversations = await query<SupportConversation & { last_message: string; message_count: string }>(
      `SELECT
        c.id,
        c.user_id,
        c.title,
        c.created_at,
        c.updated_at,
        (SELECT content FROM support_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM support_messages WHERE conversation_id = c.id) as message_count
       FROM support_conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [userId]
    )

    return NextResponse.json({
      success: true,
      data: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        preview: conv.last_message?.slice(0, 100) || '',
        message_count: parseInt(conv.message_count || '0', 10),
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      })),
    })
  } catch (error) {
    console.error('List conversations error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// DELETE /api/support/conversations - Delete a conversation
export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext(request)

  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { userId } = ctx

  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('id')

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const conversation = await queryOne<SupportConversation>(
      `SELECT id FROM support_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    )

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Delete messages first (foreign key constraint)
    await query(
      `DELETE FROM support_messages WHERE conversation_id = $1`,
      [conversationId]
    )

    // Delete conversation
    await query(
      `DELETE FROM support_conversations WHERE id = $1`,
      [conversationId]
    )

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
    })
  } catch (error) {
    console.error('Delete conversation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}

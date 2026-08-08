import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { validateApiRequest } from '@/lib/api-auth'
import { checkRateLimit, recordApiKeyUsage } from '@/lib/api-keys'

/**
 * GET /api/ai/sessions/[id]/messages
 * Return all messages for a specific chat session.
 * Auth: session owner, or admin/technician.
 * Supports dual-auth: session cookie or API key.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params

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

    // Fetch the chat session
    const chatSession = await queryOne<{
      id: string
      user_id: string | null
      organization_id: string
      title: string | null
      status: string
      resolution_status: string | null
      created_ticket_id: string | null
    }>(
      `SELECT id, user_id, organization_id, title, status, resolution_status, created_ticket_id
       FROM ai_chat_sessions
       WHERE id = $1 AND organization_id = $2`,
      [sessionId, orgId]
    )

    if (!chatSession) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check access: session owner or admin/technician
    const isOwner = chatSession.user_id === userId

    if (!isOwner) {
      let isAdminOrTech = false
      if (authCtx) {
        isAdminOrTech = ['admin', 'technician'].includes(authCtx.session.user.role || '')
      } else {
        const userRow = await queryOne<{ role: string }>('SELECT role FROM "user" WHERE id = $1', [userId])
        isAdminOrTech = ['admin', 'technician'].includes(userRow?.role || '')
      }

      if (!isAdminOrTech) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Fetch messages ordered by creation time
    const messages = await query<{
      id: string
      role: string
      content: string
      tokens_used: number | null
      model_used: string | null
      created_at: string
      metadata: Record<string, unknown> | null
      kb_gap: boolean | null
    }>(
      `SELECT id, role, content, tokens_used, model_used, created_at, metadata, kb_gap
       FROM ai_chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    )

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: chatSession.id,
          title: chatSession.title,
          status: chatSession.status,
          resolution_status: chatSession.resolution_status,
          created_ticket_id: chatSession.created_ticket_id,
        },
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          tokens_used: m.tokens_used,
          model_used: m.model_used,
          created_at: m.created_at,
          sources: (m.metadata as any)?.sources || [],
          kb_gap: m.kb_gap || false,
        })),
      },
    })
  } catch (error) {
    console.error('[AI Sessions] Messages error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, isAdminIdentity } from '@/lib/access'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { validateApiRequest } from '@/lib/api-auth'
import { checkRateLimit, recordApiKeyUsage } from '@/lib/api-keys'

/**
 * GET /api/ai/sessions
 * List recent chat sessions for the current user.
 * Admin users can see all sessions; regular users see only their own.
 * Supports dual-auth: session cookie or API key.
 */
export async function GET(request: NextRequest) {
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

    // Check if user is admin
    let isAdmin = false
    if (authCtx) {
      isAdmin = await isAdminRequest(request)
    } else {
      isAdmin = await isAdminIdentity(userId)
    }

    // Parse optional query params
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50)

    // Build query: admins see all sessions, regular users see only their own
    let sessionsQuery: string
    let params: (string | number)[]

    if (isAdmin) {
      sessionsQuery = `
        SELECT
          s.id,
          s.title,
          s.status,
          s.resolution_status,
          s.created_ticket_id,
          s.created_at,
          s.updated_at,
          (SELECT COUNT(*) FROM ai_chat_messages m WHERE m.session_id = s.id) AS message_count
        FROM ai_chat_sessions s
        WHERE s.organization_id = $1
        ORDER BY s.updated_at DESC
        LIMIT $2
      `
      params = [orgId, limit]
    } else {
      sessionsQuery = `
        SELECT
          s.id,
          s.title,
          s.status,
          s.resolution_status,
          s.created_ticket_id,
          s.created_at,
          s.updated_at,
          (SELECT COUNT(*) FROM ai_chat_messages m WHERE m.session_id = s.id) AS message_count
        FROM ai_chat_sessions s
        WHERE s.organization_id = $1 AND s.user_id = $2
        ORDER BY s.updated_at DESC
        LIMIT $3
      `
      params = [orgId, userId, limit]
    }

    const sessions = await query<{
      id: string
      title: string | null
      status: string
      resolution_status: string | null
      created_ticket_id: string | null
      created_at: string
      updated_at: string
      message_count: string
    }>(sessionsQuery, params)

    return NextResponse.json({
      success: true,
      data: sessions.map(s => ({
        id: s.id,
        title: s.title || null,
        status: s.status,
        resolution_status: s.resolution_status,
        created_ticket_id: s.created_ticket_id,
        created_at: s.created_at,
        updated_at: s.updated_at,
        message_count: parseInt(s.message_count, 10),
      })),
    })
  } catch (error) {
    console.error('[AI Sessions] List error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

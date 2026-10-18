import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, isAdminIdentity } from '@/lib/access'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { validateApiRequest } from '@/lib/api-auth'
import { checkRateLimit, recordApiKeyUsage } from '@/lib/api-keys'
import { z } from 'zod'

const ResolveRequestSchema = z.object({
  session_id: z.string().uuid(),
})

/**
 * POST /api/ai/sessions/resolve
 * Mark a chat session as resolved by the user.
 * Supports dual-auth: session cookie or API key.
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

    const body = await request.json()
    const parseResult = ResolveRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      )
    }

    const { session_id } = parseResult.data

    // Verify session ownership
    const chatSession = await queryOne<{ id: string; user_id: string | null }>(
      `SELECT id, user_id FROM ai_chat_sessions
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
        isAdmin = await isAdminRequest(request)
      } else {
        isAdmin = await isAdminIdentity(userId)
      }

      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Update session status
    await query(
      `UPDATE ai_chat_sessions
       SET resolution_status = 'resolved',
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [session_id]
    )

    return NextResponse.json({
      success: true,
      data: { session_id, resolution_status: 'resolved' },
    })
  } catch (error) {
    console.error('[AI Sessions] Resolve error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resolve session' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { z } from 'zod'

const PatchSchema = z.object({
  response_mode: z.enum(['strict', 'balanced', 'open']).optional(),
  auto_draft_threshold: z.number().int().min(0).max(20).optional(),
  session_retention_days: z.number().int().min(7).max(365).optional(),
})

/**
 * GET /api/settings/ai/config
 * Return the ai_settings row for the organization.
 * Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { session, orgId } = ctx

    // Check admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Fetch or create default settings
    let settings = await queryOne<{
      id: string
      response_mode: string
      auto_draft_threshold: number
      session_retention_days: number
      created_at: string
      updated_at: string
    }>(
      'SELECT id, response_mode, auto_draft_threshold, session_retention_days, created_at, updated_at FROM ai_settings WHERE organization_id = $1',
      [orgId]
    )

    if (!settings) {
      // Create default row if it doesn't exist yet
      settings = await queryOne<{
        id: string
        response_mode: string
        auto_draft_threshold: number
        session_retention_days: number
        created_at: string
        updated_at: string
      }>(
        `INSERT INTO ai_settings (organization_id, response_mode, auto_draft_threshold, session_retention_days)
         VALUES ($1, 'balanced', 3, 90)
         ON CONFLICT (organization_id) DO UPDATE SET updated_at = NOW()
         RETURNING id, response_mode, auto_draft_threshold, session_retention_days, created_at, updated_at`,
        [orgId]
      )
    }

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Error fetching AI settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI settings' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/ai/config
 * Update ai_settings for the organization.
 * Admin only. Validated with Zod.
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { session, userId, orgId } = ctx

    // Check admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates = parsed.data
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Build dynamic SET clause
    const setClauses: string[] = []
    const values: any[] = [orgId]
    let paramIdx = 2

    if (updates.response_mode !== undefined) {
      setClauses.push(`response_mode = $${paramIdx++}`)
      values.push(updates.response_mode)
    }
    if (updates.auto_draft_threshold !== undefined) {
      setClauses.push(`auto_draft_threshold = $${paramIdx++}`)
      values.push(updates.auto_draft_threshold)
    }
    if (updates.session_retention_days !== undefined) {
      setClauses.push(`session_retention_days = $${paramIdx++}`)
      values.push(updates.session_retention_days)
    }

    setClauses.push('updated_at = NOW()')

    const updated = await queryOne<{
      id: string
      response_mode: string
      auto_draft_threshold: number
      session_retention_days: number
      updated_at: string
    }>(
      `UPDATE ai_settings SET ${setClauses.join(', ')}
       WHERE organization_id = $1
       RETURNING id, response_mode, auto_draft_threshold, session_retention_days, updated_at`,
      values
    )

    if (!updated) {
      // Row might not exist yet — upsert
      const upserted = await queryOne<{
        id: string
        response_mode: string
        auto_draft_threshold: number
        session_retention_days: number
        updated_at: string
      }>(
        `INSERT INTO ai_settings (organization_id, response_mode, auto_draft_threshold, session_retention_days)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id) DO UPDATE SET
           response_mode = EXCLUDED.response_mode,
           auto_draft_threshold = EXCLUDED.auto_draft_threshold,
           session_retention_days = EXCLUDED.session_retention_days,
           updated_at = NOW()
         RETURNING id, response_mode, auto_draft_threshold, session_retention_days, updated_at`,
        [
          orgId,
          updates.response_mode || 'balanced',
          updates.auto_draft_threshold ?? 3,
          updates.session_retention_days ?? 90,
        ]
      )

      return NextResponse.json({ success: true, data: upserted })
    }

    // Log the settings change to audit trail
    await query(
      `INSERT INTO audit_log (organization_id, user_id, actor_type, action, action_category, entity_type, new_values)
       VALUES ($1, $2, 'user', 'update', 'settings', 'ai_settings', $3)`,
      [orgId, userId, JSON.stringify(updates)]
    ).catch((err) => {
      console.error('Failed to log AI settings change:', err)
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating AI settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update AI settings' },
      { status: 500 }
    )
  }
}

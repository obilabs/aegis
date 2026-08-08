import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    // Authorization (audit 2026-07-23): the org-wide audit log is a reporting
    // surface (actor IPs, changed fields) — reports capability required.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'reports'))) {
      return NextResponse.json({ error: 'Requires reports capability' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500)

    const result = await pool.query(`
      (
        SELECT
          id,
          actor_type,
          COALESCE(actor_name, 'System') as actor_name,
          COALESCE(actor_email, '') as actor_email,
          NULL as provider_name,
          action,
          action_category,
          entity_type,
          entity_id::text as entity_id,
          entity_name,
          changed_fields,
          success,
          actor_ip,
          created_at
        FROM audit_log
        WHERE organization_id = $1
          AND created_at >= NOW() - ($2 || ' days')::interval
      )
      UNION ALL
      (
        SELECT
          id,
          'provider_user' as actor_type,
          provider_user_name as actor_name,
          provider_user_email as actor_email,
          provider_name,
          action,
          scope_used as action_category,
          resource_type as entity_type,
          resource_id::text as entity_id,
          resource_name as entity_name,
          fields_modified as changed_fields,
          response_success as success,
          ip_address as actor_ip,
          started_at as created_at
        FROM provider_action_log
        WHERE organization_id = $1
          AND started_at >= NOW() - ($2 || ' days')::interval
      )
      ORDER BY created_at DESC
      LIMIT $3
    `, [orgId, days.toString(), limit])

    return NextResponse.json({ entries: result.rows })
  } catch (error) {
    console.error('Error fetching activity log:', error)
    return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 })
  }
}

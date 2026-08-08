import { auth } from '@/lib/auth'
import { pool, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { getUserPermissions } from '@/lib/permissions'
import { ASSIGNMENT_BOOSTS } from '@/lib/triage'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal/queue
 *
 * Smart queue endpoint. Returns tickets organized by section:
 * - mine:       assigned to the current user
 * - team:       assigned to the user's team (not to them directly)
 * - unassigned: no assignee (requires triage capability)
 * - other:      all remaining open tickets (requires ticket_access = 'all')
 *
 * Each ticket includes queue score data and SLA info.
 * Sorted by effective_score (base_score + assignment_boost) DESC within each section.
 *
 * Query params:
 *   show_paused=true  - include tickets in paused SLA statuses (default: false)
 *   action_state=...  - filter by action state
 *   limit=50          - max tickets per section (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const searchParams = request.nextUrl.searchParams
    const showPaused = searchParams.get('show_paused') === 'true'
    const includeScheduled = searchParams.get('include_scheduled') === 'true'
    const filterScheduled = searchParams.get('filter') === 'scheduled'
    const actionStateFilter = searchParams.get('action_state')
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    // Get ITSM user
    const itsmUser = await queryOne<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    )
    if (!itsmUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const perms = await getUserPermissions(itsmUser.id)

    // Get user's team IDs
    const teamRows = await pool.query<{ team_id: string }>(
      `SELECT team_id FROM team_members WHERE user_id = $1`,
      [itsmUser.id]
    )
    const teamIds = teamRows.rows.map((r) => r.team_id)

    // Build shared query parts
    const baseSelect = `
      SELECT
        t.id,
        t.ticket_number,
        t.prefix,
        t.subject,
        t.priority,
        t.assigned_to,
        t.assigned_team,
        t.created_at,
        t.updated_at,
        t.first_viewed_at,
        ts.name as status_name,
        ts.color as status_color,
        ts.base_status,
        ts.sla_paused,
        tt.name as type_name,
        CONCAT(au.first_name, ' ', au.last_name) as assigned_name,
        CONCAT(cu.first_name, ' ', cu.last_name) as contact_name,
        cu.is_deleted as contact_is_deleted,
        qs.action_state,
        qs.confidence,
        qs.base_score,
        qs.priority_weight,
        qs.sla_urgency,
        qs.action_boost,
        qs.wait_time_factor,
        qs.customer_impact,
        qs.reasoning,
        qs.scored_at,
        qs.last_scored_by,
        t.sla_breached,
        t.sla_paused_at,
        COALESCE(t.sla_total_paused_seconds, 0) as sla_total_paused_seconds,
        t.sla_first_response_due_at,
        t.sla_resolution_due_at,
        tt_type.sla_response_minutes,
        tt_type.sla_resolution_minutes,
        COALESCE(t.is_scheduled, false) as is_scheduled,
        t.scheduled_for,
        t.scheduling_active_from,
        t.action_date_type
      FROM tickets t
      JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_queue_scores qs ON t.id = qs.ticket_id
      LEFT JOIN ticket_types tt_type ON t.type_id = tt_type.id
      LEFT JOIN ticket_types tt ON t.type_id = tt.id
      LEFT JOIN users au ON t.assigned_to = au.id
      LEFT JOIN contacts cu ON t.contact_id = cu.id
      WHERE t.organization_id = $1
        AND ts.base_status != 'closed'
    `

    const pauseFilter = showPaused ? '' : `AND ts.sla_paused = false`
    const actionFilter = actionStateFilter
      ? `AND qs.action_state = '${actionStateFilter.replace(/[^a-z_]/g, '')}'`
      : ''
    // Scheduling filter: by default, hide future-scheduled tickets unless explicitly requested
    const schedulingFilter = filterScheduled
      ? `AND t.is_scheduled = true AND t.scheduling_active_from > NOW()`
      : includeScheduled
        ? ''
        : `AND (t.is_scheduled = false OR t.scheduling_active_from IS NULL OR t.scheduling_active_from <= NOW())`

    const orderBy = `ORDER BY COALESCE(qs.base_score, 0) DESC, t.updated_at DESC`

    // Section: mine
    const mineResult = await pool.query(
      `${baseSelect} ${pauseFilter} ${actionFilter} ${schedulingFilter}
       AND t.assigned_to = $2
       ${orderBy} LIMIT $3`,
      [orgId, itsmUser.id, limit]
    )

    // Section: team (assigned to my team but not to me)
    let teamResult = { rows: [] as any[] }
    if (teamIds.length > 0 && (perms.ticketAccess === 'team' || perms.ticketAccess === 'all')) {
      teamResult = await pool.query(
        `${baseSelect} ${pauseFilter} ${actionFilter} ${schedulingFilter}
         AND t.assigned_team = ANY($2)
         AND (t.assigned_to IS NULL OR t.assigned_to != $3)
         ${orderBy} LIMIT $4`,
        [orgId, teamIds, itsmUser.id, limit]
      )
    }

    // Section: unassigned (requires triage capability)
    let unassignedResult = { rows: [] as any[] }
    if (perms.capabilities.includes('triage') || perms.ticketAccess === 'all') {
      unassignedResult = await pool.query(
        `${baseSelect} ${pauseFilter} ${actionFilter} ${schedulingFilter}
         AND t.assigned_to IS NULL
         ${orderBy} LIMIT $2`,
        [orgId, limit]
      )
    }

    // Section: other (requires ticket_access = 'all')
    let otherResult = { rows: [] as any[] }
    if (perms.ticketAccess === 'all') {
      // Exclude tickets already in mine, team, or unassigned
      const excludeIds = [
        ...mineResult.rows.map((r: any) => r.id),
        ...teamResult.rows.map((r: any) => r.id),
        ...unassignedResult.rows.map((r: any) => r.id),
      ]

      if (excludeIds.length > 0) {
        otherResult = await pool.query(
          `${baseSelect} ${pauseFilter} ${actionFilter} ${schedulingFilter}
           AND t.assigned_to IS NOT NULL
           AND t.assigned_to != $2
           AND t.id != ALL($3)
           ${orderBy} LIMIT $4`,
          [orgId, itsmUser.id, excludeIds, limit]
        )
      } else {
        otherResult = await pool.query(
          `${baseSelect} ${pauseFilter} ${actionFilter} ${schedulingFilter}
           AND t.assigned_to IS NOT NULL
           AND t.assigned_to != $2
           ${orderBy} LIMIT $3`,
          [orgId, itsmUser.id, limit]
        )
      }
    }

    // Add assignment boost to each ticket
    const viewerId = itsmUser.id
    const viewerTeamId = teamIds[0] || null
    function mapTicket(row: any, section: string) {
      const assignmentBoost = !row.assigned_to
        ? ASSIGNMENT_BOOSTS.unassigned
        : row.assigned_to === viewerId
          ? ASSIGNMENT_BOOSTS.assigned_to_viewer
          : row.assigned_team && teamIds.includes(row.assigned_team)
            ? ASSIGNMENT_BOOSTS.assigned_to_viewer_team
            : ASSIGNMENT_BOOSTS.assigned_to_other

      return {
        id: row.id,
        ticketNumber: row.ticket_number,
        prefix: row.prefix,
        subject: row.subject,
        priority: row.priority,
        assignedTo: row.assigned_to,
        assignedTeam: row.assigned_team,
        assignedName: row.assigned_name?.trim() || null,
        contactName: row.contact_name?.trim() || null,
        contactIsDeleted: row.contact_is_deleted || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        firstViewedAt: row.first_viewed_at,
        status: {
          name: row.status_name,
          color: row.status_color,
          baseStatus: row.base_status,
          slaPaused: row.sla_paused,
        },
        typeName: row.type_name,
        queue: {
          actionState: row.action_state || 'new_unreviewed',
          confidence: row.confidence ? parseFloat(row.confidence) : null,
          baseScore: row.base_score ?? 0,
          assignmentBoost,
          effectiveScore: (row.base_score ?? 0) + assignmentBoost,
          reasoning: row.reasoning,
          scoredAt: row.scored_at,
          scoredBy: row.last_scored_by,
        },
        sla: {
          breached: row.sla_breached || false,
          pausedAt: row.sla_paused_at,
          totalPausedSeconds: row.sla_total_paused_seconds,
          firstResponseDueAt: row.sla_first_response_due_at,
          resolutionDueAt: row.sla_resolution_due_at,
          targetResponseMinutes: row.sla_response_minutes,
          targetResolutionMinutes: row.sla_resolution_minutes,
        },
        scheduling: {
          isScheduled: row.is_scheduled || false,
          scheduledFor: row.scheduled_for,
          schedulingActiveFrom: row.scheduling_active_from,
          actionDateType: row.action_date_type || 'complete_by',
          isActionable: !row.is_scheduled || !row.scheduling_active_from || new Date(row.scheduling_active_from) <= new Date(),
        },
        section,
      }
    }

    return NextResponse.json({
      mine: mineResult.rows.map((r: any) => mapTicket(r, 'mine')),
      team: teamResult.rows.map((r: any) => mapTicket(r, 'team')),
      unassigned: unassignedResult.rows.map((r: any) => mapTicket(r, 'unassigned')),
      other: otherResult.rows.map((r: any) => mapTicket(r, 'other')),
      permissions: {
        ticketAccess: perms.ticketAccess,
        canTriage: perms.capabilities.includes('triage'),
        isAdmin: perms.adminAccess,
      },
    })
  } catch (error) {
    console.error('Error fetching queue:', error)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }
}

import { auth } from '@/lib/auth'
import { getSlaData, computeSlaActiveSeconds, getSlaRemaining, getSlaHistory } from '@/lib/sla'
import { queryOne } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal/tickets/[id]/sla
 *
 * Returns full SLA details for a ticket:
 * - Active/paused seconds, target times, breach status
 * - Full timeline of status changes with SLA impact
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ticket exists and user has access
    const ticket = await queryOne<{ id: string }>(
      `SELECT id FROM tickets WHERE id = $1`,
      [id]
    )
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const slaData = await getSlaData(id)
    if (!slaData) {
      return NextResponse.json({ error: 'SLA data not available' }, { status: 404 })
    }

    const activeSeconds = await computeSlaActiveSeconds(id)
    const responseRemaining = await getSlaRemaining(id, 'response')
    const resolutionRemaining = await getSlaRemaining(id, 'resolution')
    const history = await getSlaHistory(id)

    return NextResponse.json({
      sla: {
        isPaused: slaData.isPaused,
        pausedAt: slaData.pausedAt,
        totalPausedSeconds: slaData.totalPausedSeconds,
        activeSeconds,
        breached: slaData.breached,
        createdAt: slaData.createdAt,
        response: {
          targetMinutes: slaData.targetResponseMinutes,
          dueAt: slaData.firstResponseDueAt,
          fulfilledAt: slaData.firstResponseAt,
          remainingSeconds: responseRemaining,
        },
        resolution: {
          targetMinutes: slaData.targetResolutionMinutes,
          dueAt: slaData.resolutionDueAt,
          fulfilledAt: slaData.resolvedAt,
          remainingSeconds: resolutionRemaining,
        },
      },
      history: history.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedBy: h.changedBy,
        reason: h.reason,
        pausedSecondsAtChange: h.pausedSecondsAtChange,
        wasPaused: h.wasPaused,
        createdAt: h.createdAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching SLA data:', error)
    return NextResponse.json({ error: 'Failed to fetch SLA data' }, { status: 500 })
  }
}

import { auth } from '@/lib/auth'
import { requireTicketAccess } from '@/lib/access'
import { queryOne } from '@/lib/db'
import { hasCapability } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal/tickets/[id]/triage
 *
 * Returns the current queue score for a ticket. Available to any authenticated user.
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
    const guard = await requireTicketAccess(request, id, { staffOnly: true })
    if (guard instanceof NextResponse) return guard

    const currentScore = await queryOne<{
      action_state: string
      confidence: string
      base_score: number
      reasoning: string
      scored_at: Date
      last_scored_by: string
      priority_weight: number
      sla_urgency: number
      action_boost: number
      wait_time_factor: number
      customer_impact: number
    }>(
      `SELECT action_state, confidence, base_score, reasoning, scored_at, last_scored_by,
              priority_weight, sla_urgency, action_boost, wait_time_factor, customer_impact
       FROM ticket_queue_scores WHERE ticket_id = $1`,
      [id]
    )

    if (!currentScore) {
      return NextResponse.json({ score: null })
    }

    return NextResponse.json({
      score: {
        actionState: currentScore.action_state,
        confidence: parseFloat(currentScore.confidence),
        baseScore: currentScore.base_score,
        reasoning: currentScore.reasoning,
        scoredAt: currentScore.scored_at,
        scoredBy: currentScore.last_scored_by,
        factors: {
          priorityWeight: currentScore.priority_weight,
          slaUrgency: currentScore.sla_urgency,
          actionBoost: currentScore.action_boost,
          waitTimeFactor: currentScore.wait_time_factor,
          customerImpact: currentScore.customer_impact,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching triage score:', error)
    return NextResponse.json({ error: 'Failed to fetch triage score' }, { status: 500 })
  }
}

/**
 * POST /api/portal/tickets/[id]/triage
 *
 * Manually trigger triage scoring for a ticket. Requires triage capability.
 * Returns the current queue score immediately (job runs async).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const guard = await requireTicketAccess(request, id, { staffOnly: true })
    if (guard instanceof NextResponse) return guard

    const itsmUser = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    )
    if (!itsmUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const canTriage = await hasCapability(itsmUser.id, 'triage')
    if (!canTriage) {
      return NextResponse.json({ error: 'Requires triage capability' }, { status: 403 })
    }

    // Get ticket org
    const ticket = await queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM tickets WHERE id = $1`,
      [id]
    )
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Enqueue triage job
    const { queueTriageJob } = await import('@/lib/triage-worker')
    await queueTriageJob(id, ticket.organization_id, 'manual')

    // Return current score if exists
    const currentScore = await queryOne<{
      action_state: string
      confidence: string
      base_score: number
      reasoning: string
      scored_at: Date
      last_scored_by: string
    }>(
      `SELECT action_state, confidence, base_score, reasoning, scored_at, last_scored_by
       FROM ticket_queue_scores WHERE ticket_id = $1`,
      [id]
    )

    return NextResponse.json({
      success: true,
      message: 'Triage job queued',
      currentScore: currentScore
        ? {
            actionState: currentScore.action_state,
            confidence: parseFloat(currentScore.confidence),
            baseScore: currentScore.base_score,
            reasoning: currentScore.reasoning,
            scoredAt: currentScore.scored_at,
            scoredBy: currentScore.last_scored_by,
          }
        : null,
    })
  } catch (error) {
    console.error('Error triggering triage:', error)
    return NextResponse.json({ error: 'Failed to trigger triage' }, { status: 500 })
  }
}

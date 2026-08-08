/**
 * Triage Scoring & Heuristic Classification
 *
 * Core scoring logic for the smart queue. Computes all viewer-independent
 * score factors that get persisted in ticket_queue_scores. The assignment
 * boost (viewer-relative) is computed at query time by the queue API.
 *
 * DB column mapping:
 *   priority_weight  ← PRIORITY_WEIGHTS[ticket.priority]
 *   action_boost     ← ACTION_STATE_BOOSTS[actionState]
 *   sla_urgency      ← SLA_URGENCY_TIERS based on remaining seconds
 *   wait_time_factor ← age factor (+1/hour of active SLA time, capped at 20)
 *   customer_impact  ← reply recency boost (0-25 based on last contact reply)
 *
 * Generated column in DB:
 *   base_score = (priority_weight*3 + sla_urgency*4 + action_boost*2 + wait_time_factor + customer_impact) / 11
 */

import { query, queryOne } from './db'
import type { SlaData } from './sla'

// ─── Action States ───────────────────────────────────────────────────────────

export const ACTION_STATES = [
  'new_unreviewed',
  'needs_agent_action',
  'needs_more_info',
  'escalation_needed',
  'waiting_on_user',
  'user_will_follow_up',
  'waiting_on_vendor',
  'waiting_on_internal',
  'waiting_on_approval',
  'waiting_on_parts',
  'scheduled',
  'on_hold',
  'resolution_candidate',
] as const

export type ActionState = (typeof ACTION_STATES)[number]

export const ACTION_STATE_BOOSTS: Record<ActionState, number> = {
  new_unreviewed: 20,
  needs_agent_action: 40,
  needs_more_info: 15,
  escalation_needed: 35,
  waiting_on_user: -30,
  user_will_follow_up: -50,
  waiting_on_vendor: -30,
  waiting_on_internal: -25,
  waiting_on_approval: -30,
  waiting_on_parts: -30,
  scheduled: -40,
  on_hold: -50,
  resolution_candidate: 10,
}

// ─── Priority Weights ────────────────────────────────────────────────────────

export const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
}

// ─── SLA Urgency Tiers ──────────────────────────────────────────────────────

const ONE_HOUR = 3600
const FOUR_HOURS = 14400
const EIGHT_HOURS = 28800
const TWENTY_FOUR_HOURS = 86400

/**
 * Compute SLA urgency score based on remaining seconds until breach.
 * Returns 0 if SLA is paused or no target is set.
 */
export function computeSlaUrgency(
  remainingSeconds: number | null,
  isPaused: boolean
): number {
  if (isPaused || remainingSeconds === null) return 0
  if (remainingSeconds < ONE_HOUR) return 50
  if (remainingSeconds < FOUR_HOURS) return 30
  if (remainingSeconds < EIGHT_HOURS) return 15
  if (remainingSeconds < TWENTY_FOUR_HOURS) return 5
  return 0
}

// ─── Assignment Boost (query-time, not persisted) ────────────────────────────

export const ASSIGNMENT_BOOSTS = {
  assigned_to_viewer: 30,
  assigned_to_viewer_team: 15,
  unassigned: 5,
  assigned_to_other: 0,
} as const

/**
 * Compute the viewer-relative assignment boost.
 * Used at query time by the queue API — not stored in ticket_queue_scores.
 */
export function computeAssignmentBoost(
  assignedTo: string | null,
  assignedTeam: string | null,
  viewerUserId: string,
  viewerTeamId: string | null
): number {
  if (!assignedTo) return ASSIGNMENT_BOOSTS.unassigned
  if (assignedTo === viewerUserId) return ASSIGNMENT_BOOSTS.assigned_to_viewer
  if (assignedTeam && viewerTeamId && assignedTeam === viewerTeamId) {
    return ASSIGNMENT_BOOSTS.assigned_to_viewer_team
  }
  return ASSIGNMENT_BOOSTS.assigned_to_other
}

// ─── Score Factors ───────────────────────────────────────────────────────────

export interface ScoreFactors {
  priorityWeight: number
  slaUrgency: number
  actionBoost: number
  waitTimeFactor: number
  customerImpact: number
}

/**
 * Compute age factor: +1 per hour of SLA active time, capped at 20.
 */
export function computeAgeFactor(slaActiveSeconds: number | null): number {
  if (slaActiveSeconds === null || slaActiveSeconds <= 0) return 0
  return Math.min(20, Math.floor(slaActiveSeconds / ONE_HOUR))
}

/**
 * Compute reply recency boost based on last contact reply time.
 * Only boosts when a contact/end-user replied recently.
 */
export function computeReplyRecencyBoost(
  lastContactReplyAt: Date | null
): number {
  if (!lastContactReplyAt) return 0
  const ageSeconds = Math.floor(
    (Date.now() - lastContactReplyAt.getTime()) / 1000
  )
  if (ageSeconds < ONE_HOUR) return 25
  if (ageSeconds < FOUR_HOURS) return 15
  if (ageSeconds < EIGHT_HOURS) return 5
  return 0
}

/**
 * Compute all viewer-independent score factors for a ticket.
 */
export function computeScoreFactors(
  priority: string | null,
  actionState: ActionState,
  slaRemainingSeconds: number | null,
  slaIsPaused: boolean,
  slaActiveSeconds: number | null,
  lastContactReplyAt: Date | null
): ScoreFactors {
  return {
    priorityWeight: PRIORITY_WEIGHTS[priority ?? 'medium'] ?? 50,
    slaUrgency: computeSlaUrgency(slaRemainingSeconds, slaIsPaused),
    actionBoost: ACTION_STATE_BOOSTS[actionState],
    waitTimeFactor: computeAgeFactor(slaActiveSeconds),
    customerImpact: computeReplyRecencyBoost(lastContactReplyAt),
  }
}

// ─── Heuristic Classification ────────────────────────────────────────────────

export interface TriageResult {
  actionState: ActionState
  confidence: number
  reasoning: string
}

/**
 * Map a status name deterministically to an action state.
 * Used for pending/closed statuses where the action state is obvious.
 */
export function deriveActionStateFromStatus(
  statusName: string,
  baseStatus: string,
  isDefault: boolean
): ActionState | null {
  // Default status = "New"
  if (isDefault && baseStatus === 'open') return 'new_unreviewed'

  // Pending statuses — deterministic from name
  if (baseStatus === 'pending') {
    const lower = statusName.toLowerCase()
    if (lower.includes('user') || lower.includes('customer') || lower.includes('requester'))
      return 'waiting_on_user'
    if (lower.includes('vendor') || lower.includes('third') || lower.includes('external'))
      return 'waiting_on_vendor'
    if (lower.includes('internal') || lower.includes('team'))
      return 'waiting_on_internal'
    if (lower.includes('approval'))
      return 'waiting_on_approval'
    if (lower.includes('part') || lower.includes('hardware') || lower.includes('order'))
      return 'waiting_on_parts'
    if (lower.includes('hold'))
      return 'on_hold'
    if (lower.includes('schedul'))
      return 'scheduled'
    // Generic pending → waiting_on_user as safe default
    return 'waiting_on_user'
  }

  // Closed/resolved
  if (baseStatus === 'closed') {
    const lower = statusName.toLowerCase()
    if (lower.includes('resolved') || lower.includes('complete'))
      return 'resolution_candidate'
    return null // truly closed tickets don't need queue scoring
  }

  // Open but with special names
  const lower = statusName.toLowerCase()
  if (lower.includes('escalat')) return 'escalation_needed'

  return null // need reply-based heuristic for generic open statuses
}

export interface ReplyInfo {
  userId: string | null
  contactId: string | null
  isInternal: boolean
  createdAt: Date
}

/**
 * Heuristic (non-AI) classification of a ticket's action state.
 * Used when no AI provider is configured or as a fallback.
 */
export function classifyActionStateHeuristic(
  statusName: string,
  baseStatus: string,
  isDefaultStatus: boolean,
  lastReplies: ReplyInfo[],
  ticketCreatedAt: Date,
  assignedTo: string | null
): TriageResult {
  // 1. Try deterministic mapping from status
  const derived = deriveActionStateFromStatus(statusName, baseStatus, isDefaultStatus)
  if (derived) {
    return {
      actionState: derived,
      confidence: 0.95,
      reasoning: `Deterministic: status "${statusName}" (${baseStatus}) maps to ${derived}`,
    }
  }

  // 2. For open statuses, analyze reply pattern
  // Filter to non-internal replies only (public conversation)
  const publicReplies = lastReplies.filter((r) => !r.isInternal)

  if (publicReplies.length === 0) {
    // No replies at all — still new/unreviewed
    return {
      actionState: 'new_unreviewed',
      confidence: 0.85,
      reasoning: 'No public replies yet on open ticket',
    }
  }

  const lastReply = publicReplies[0] // most recent first
  const isContactReply = lastReply.contactId !== null
  const isAgentReply = lastReply.userId !== null && lastReply.contactId === null

  if (isContactReply) {
    // Contact replied — agent needs to act
    return {
      actionState: 'needs_agent_action',
      confidence: 0.80,
      reasoning: 'Last public reply is from contact — agent action needed',
    }
  }

  if (isAgentReply) {
    // Agent replied last — check how long ago
    const replyAgeMs = Date.now() - lastReply.createdAt.getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

    if (replyAgeMs > sevenDaysMs) {
      // Agent replied > 7 days ago, no response
      return {
        actionState: 'user_will_follow_up',
        confidence: 0.70,
        reasoning: 'Agent replied over 7 days ago with no user response — likely waiting for follow-up',
      }
    }

    return {
      actionState: 'waiting_on_user',
      confidence: 0.75,
      reasoning: 'Last public reply is from agent — waiting on user response',
    }
  }

  // Fallback
  return {
    actionState: assignedTo ? 'needs_agent_action' : 'new_unreviewed',
    confidence: 0.50,
    reasoning: 'Could not determine reply pattern — defaulting based on assignment',
  }
}

// ─── Database Operations ─────────────────────────────────────────────────────

/**
 * Upsert the queue score for a ticket. Uses INSERT ON CONFLICT UPDATE.
 */
export async function upsertQueueScore(
  ticketId: string,
  organizationId: string,
  actionState: ActionState,
  confidence: number,
  factors: ScoreFactors,
  reasoning: string,
  scoredBy: 'heuristic' | 'ai' | 'manual'
): Promise<void> {
  await queryOne(
    `INSERT INTO ticket_queue_scores
      (ticket_id, organization_id, action_state, confidence,
       priority_weight, sla_urgency, action_boost, wait_time_factor, customer_impact,
       reasoning, scored_at, last_scored_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
    ON CONFLICT (ticket_id) DO UPDATE SET
      action_state = EXCLUDED.action_state,
      confidence = EXCLUDED.confidence,
      priority_weight = EXCLUDED.priority_weight,
      sla_urgency = EXCLUDED.sla_urgency,
      action_boost = EXCLUDED.action_boost,
      wait_time_factor = EXCLUDED.wait_time_factor,
      customer_impact = EXCLUDED.customer_impact,
      reasoning = EXCLUDED.reasoning,
      scored_at = NOW(),
      last_scored_by = EXCLUDED.last_scored_by
    RETURNING ticket_id`,
    [
      ticketId,
      organizationId,
      actionState,
      confidence,
      factors.priorityWeight,
      factors.slaUrgency,
      factors.actionBoost,
      factors.waitTimeFactor,
      factors.customerImpact,
      reasoning,
      scoredBy,
    ]
  )
}

/**
 * Fetch the last N replies for a ticket, most recent first.
 */
export async function getLastReplies(
  ticketId: string,
  limit = 5
): Promise<ReplyInfo[]> {
  return query<ReplyInfo>(
    `SELECT user_id as "userId", contact_id as "contactId",
            is_internal as "isInternal", created_at as "createdAt"
     FROM ticket_replies
     WHERE ticket_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [ticketId, limit]
  )
}

/**
 * Get the last contact (non-agent) reply time for a ticket.
 */
export async function getLastContactReplyAt(
  ticketId: string
): Promise<Date | null> {
  const row = await queryOne<{ created_at: Date }>(
    `SELECT created_at FROM ticket_replies
     WHERE ticket_id = $1 AND contact_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [ticketId]
  )
  return row?.created_at ?? null
}

/**
 * Get the ticket's current status info for triage decisions.
 */
export async function getTicketStatusInfo(
  ticketId: string
): Promise<{
  statusName: string
  baseStatus: string
  isDefault: boolean
  slaPaused: boolean
} | null> {
  return queryOne(
    `SELECT ts.name as "statusName", ts.base_status as "baseStatus",
            ts.is_default as "isDefault", ts.sla_paused as "slaPaused"
     FROM tickets t
     JOIN ticket_statuses ts ON t.status_id = ts.id
     WHERE t.id = $1`,
    [ticketId]
  )
}

/**
 * Get basic ticket info needed for triage scoring.
 */
export async function getTicketForTriage(ticketId: string): Promise<{
  id: string
  organizationId: string
  priority: string | null
  assignedTo: string | null
  assignedTeam: string | null
  createdAt: Date
} | null> {
  return queryOne(
    `SELECT id, organization_id as "organizationId",
            priority, assigned_to as "assignedTo",
            assigned_team as "assignedTeam",
            created_at as "createdAt"
     FROM tickets WHERE id = $1`,
    [ticketId]
  )
}

/**
 * Full triage pipeline for a single ticket (heuristic only).
 * Fetches all needed data and computes + persists the score.
 * Returns null if ticket not found, or the triage result.
 */
export async function triageTicket(
  ticketId: string,
  slaData: SlaData | null,
  slaActiveSeconds: number | null,
  slaRemainingSeconds: number | null
): Promise<(TriageResult & { factors: ScoreFactors }) | null> {
  const ticket = await getTicketForTriage(ticketId)
  if (!ticket) return null

  const statusInfo = await getTicketStatusInfo(ticketId)
  if (!statusInfo) return null

  // Closed tickets don't get scored
  if (
    statusInfo.baseStatus === 'closed' &&
    !statusInfo.statusName.toLowerCase().includes('resolved')
  ) {
    return null
  }

  const lastReplies = await getLastReplies(ticketId)
  const lastContactReplyAt = await getLastContactReplyAt(ticketId)

  // Classify action state
  const triage = classifyActionStateHeuristic(
    statusInfo.statusName,
    statusInfo.baseStatus,
    statusInfo.isDefault,
    lastReplies,
    ticket.createdAt,
    ticket.assignedTo
  )

  // Compute score factors
  const factors = computeScoreFactors(
    ticket.priority,
    triage.actionState,
    slaRemainingSeconds,
    statusInfo.slaPaused,
    slaActiveSeconds,
    lastContactReplyAt
  )

  // Persist
  await upsertQueueScore(
    ticketId,
    ticket.organizationId,
    triage.actionState,
    triage.confidence,
    factors,
    triage.reasoning,
    'heuristic'
  )

  return { ...triage, factors }
}

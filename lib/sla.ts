/**
 * SLA Clock Utilities (Read-Only)
 *
 * Works WITH the existing database trigger (handle_ticket_status_change)
 * from migration 025. The trigger handles SLA pause/resume writes
 * automatically when ticket status changes. This module only reads state.
 *
 * Key concepts:
 * - "Active seconds" = wall clock minus total paused time
 * - SLA targets come from ticket_types (sla_response_minutes, sla_resolution_minutes)
 * - The DB trigger adjusts sla_due_at when pausing/resuming
 * - sla_breached is a flag on the ticket row
 */

import { query, queryOne } from './db'

export interface SlaData {
  ticketId: string
  /** Whether the SLA clock is currently paused */
  isPaused: boolean
  /** When the current pause started (null if not paused) */
  pausedAt: Date | null
  /** Total seconds the ticket has been paused across all pauses */
  totalPausedSeconds: number
  /** When the ticket was created */
  createdAt: Date
  /** Effective SLA start time (scheduling_active_from for scheduled tickets, else created_at) */
  effectiveStartAt: Date
  /** First response SLA due date */
  firstResponseDueAt: Date | null
  /** When first response was actually made */
  firstResponseAt: Date | null
  /** Resolution SLA due date */
  resolutionDueAt: Date | null
  /** When the ticket was resolved */
  resolvedAt: Date | null
  /** Whether any SLA target has been breached */
  breached: boolean
  /** SLA target: response time in minutes (from ticket type) */
  targetResponseMinutes: number | null
  /** SLA target: resolution time in minutes (from ticket type) */
  targetResolutionMinutes: number | null
  /** Whether this ticket is scheduled for a future date */
  isScheduled: boolean
  /** The scheduled-for date (null if not scheduled) */
  scheduledFor: Date | null
  /** When the ticket becomes actionable (null if not scheduled) */
  schedulingActiveFrom: Date | null
  /** Whether the ticket is currently actionable */
  isActionable: boolean
}

/**
 * Get full SLA state for a ticket.
 */
export async function getSlaData(ticketId: string): Promise<SlaData | null> {
  const row = await queryOne<{
    id: string
    sla_paused_at: Date | null
    sla_total_paused_seconds: number
    created_at: Date
    sla_first_response_due_at: Date | null
    sla_first_response_at: Date | null
    sla_resolution_due_at: Date | null
    sla_resolved_at: Date | null
    sla_breached: boolean
    sla_response_minutes: number | null
    sla_resolution_minutes: number | null
    is_scheduled: boolean
    scheduled_for: Date | null
    scheduling_active_from: Date | null
  }>(
    `SELECT
      t.id,
      t.sla_paused_at,
      COALESCE(t.sla_total_paused_seconds, 0) as sla_total_paused_seconds,
      t.created_at,
      t.sla_first_response_due_at,
      t.sla_first_response_at,
      t.sla_resolution_due_at,
      t.sla_resolved_at,
      COALESCE(t.sla_breached, false) as sla_breached,
      tt.sla_response_minutes,
      tt.sla_resolution_minutes,
      COALESCE(t.is_scheduled, false) as is_scheduled,
      t.scheduled_for,
      t.scheduling_active_from
    FROM tickets t
    LEFT JOIN ticket_types tt ON t.type_id = tt.id
    WHERE t.id = $1`,
    [ticketId]
  )

  if (!row) return null

  const now = new Date()
  const effectiveStartAt = row.scheduling_active_from || row.created_at
  const isActionable = !row.is_scheduled || !row.scheduling_active_from || row.scheduling_active_from <= now

  return {
    ticketId: row.id,
    isPaused: row.sla_paused_at !== null,
    pausedAt: row.sla_paused_at,
    totalPausedSeconds: row.sla_total_paused_seconds,
    createdAt: row.created_at,
    effectiveStartAt,
    firstResponseDueAt: row.sla_first_response_due_at,
    firstResponseAt: row.sla_first_response_at,
    resolutionDueAt: row.sla_resolution_due_at,
    resolvedAt: row.sla_resolved_at,
    breached: row.sla_breached,
    targetResponseMinutes: row.sla_response_minutes,
    targetResolutionMinutes: row.sla_resolution_minutes,
    isScheduled: row.is_scheduled,
    scheduledFor: row.scheduled_for,
    schedulingActiveFrom: row.scheduling_active_from,
    isActionable,
  }
}

/**
 * Compute the total "active" seconds (wall clock minus paused time).
 * If the ticket is currently paused, the active period is up to when the pause started.
 */
export async function computeSlaActiveSeconds(ticketId: string): Promise<number | null> {
  const data = await getSlaData(ticketId)
  if (!data) return null

  const now = new Date()
  const wallSeconds = Math.floor((now.getTime() - data.effectiveStartAt.getTime()) / 1000)

  let pausedSeconds = data.totalPausedSeconds
  // If currently paused, add the duration of the current pause
  if (data.isPaused && data.pausedAt) {
    pausedSeconds += Math.floor((now.getTime() - data.pausedAt.getTime()) / 1000)
  }

  return Math.max(0, wallSeconds - pausedSeconds)
}

/**
 * Get remaining seconds until SLA breach for response or resolution.
 * Returns negative values if already breached.
 * Returns null if no SLA target is set.
 */
export async function getSlaRemaining(
  ticketId: string,
  target: 'response' | 'resolution'
): Promise<number | null> {
  const data = await getSlaData(ticketId)
  if (!data) return null

  const dueAt = target === 'response' ? data.firstResponseDueAt : data.resolutionDueAt

  if (!dueAt) return null

  // If already fulfilled, return the surplus (positive = good)
  if (target === 'response' && data.firstResponseAt) {
    return Math.floor((dueAt.getTime() - data.firstResponseAt.getTime()) / 1000)
  }
  if (target === 'resolution' && data.resolvedAt) {
    return Math.floor((dueAt.getTime() - data.resolvedAt.getTime()) / 1000)
  }

  // Still open — remaining time from now
  const now = new Date()
  return Math.floor((dueAt.getTime() - now.getTime()) / 1000)
}

/**
 * Check if a ticket's SLA has been breached and update the flag if needed.
 * Returns true if currently breached.
 */
export async function checkSlaBreach(ticketId: string): Promise<boolean> {
  const data = await getSlaData(ticketId)
  if (!data) return false

  const now = new Date()
  let breached = false

  // Check response SLA
  if (data.firstResponseDueAt && !data.firstResponseAt && now > data.firstResponseDueAt) {
    breached = true
  }

  // Check resolution SLA
  if (data.resolutionDueAt && !data.resolvedAt && now > data.resolutionDueAt) {
    breached = true
  }

  // Update flag if changed
  if (breached && !data.breached) {
    await queryOne(
      `UPDATE tickets SET sla_breached = true WHERE id = $1 RETURNING id`,
      [ticketId]
    )
  }

  return breached || data.breached
}

export interface SlaHistoryEntry {
  id: string
  fromStatus: string | null
  toStatus: string
  changedBy: string | null
  reason: string | null
  pausedSecondsAtChange: number
  wasPaused: boolean
  createdAt: Date
}

/**
 * Get the SLA-relevant status change history for a ticket.
 * Reads from ticket_status_history (populated by the DB trigger).
 */
export async function getSlaHistory(ticketId: string): Promise<SlaHistoryEntry[]> {
  const rows = await query<{
    id: string
    from_status_name: string | null
    to_status_name: string
    changed_by_name: string | null
    reason: string | null
    sla_paused_seconds_at_change: number
    sla_was_paused: boolean
    created_at: Date
  }>(
    `SELECT
      h.id,
      fs.name as from_status_name,
      ts.name as to_status_name,
      CONCAT(u.first_name, ' ', u.last_name) as changed_by_name,
      h.reason,
      COALESCE(h.sla_paused_seconds_at_change, 0) as sla_paused_seconds_at_change,
      COALESCE(h.sla_was_paused, false) as sla_was_paused,
      h.created_at
    FROM ticket_status_history h
    LEFT JOIN ticket_statuses fs ON h.from_status_id = fs.id
    JOIN ticket_statuses ts ON h.to_status_id = ts.id
    LEFT JOIN users u ON h.changed_by = u.id
    WHERE h.ticket_id = $1
    ORDER BY h.created_at ASC`,
    [ticketId]
  )

  return rows.map((r) => ({
    id: r.id,
    fromStatus: r.from_status_name,
    toStatus: r.to_status_name,
    changedBy: r.changed_by_name,
    reason: r.reason,
    pausedSecondsAtChange: r.sla_paused_seconds_at_change,
    wasPaused: r.sla_was_paused,
    createdAt: r.created_at,
  }))
}

// ---------------------------------------------------------------------------
// SLA status classification for MTP polling
// ---------------------------------------------------------------------------

/**
 * `on-track` | `at-risk` | `breached`. Computed from a
 * ticket's SLA state at a specific `now`. Used by the MTP
 * pairing polling endpoint to emit `sla_status` per ticket
 * without MTP having to re-derive from raw deadlines.
 *
 * Rules (spec: `msp-poller-extension-sla-triage`, D1):
 * - `breached` if any deadline is in the past AND the
 *   corresponding response has not been made
 * - `at-risk` if the nearest-active deadline has less than
 *   25% of its original SLA window remaining
 * - `on-track` otherwise, including when no SLA applies
 */
export type SlaStatus = 'on-track' | 'at-risk' | 'breached'

export interface SlaStatusInput {
  effectiveStartAt: Date | null
  firstResponseDueAt: Date | null
  firstResponseAt: Date | null
  resolutionDueAt: Date | null
  resolvedAt: Date | null
  targetResponseMinutes: number | null
  targetResolutionMinutes: number | null
}

const AT_RISK_THRESHOLD = 0.25

export function computeSlaStatus(
  input: SlaStatusInput,
  now: Date = new Date(),
): SlaStatus {
  const nowMs = now.getTime()

  // Any past deadline whose response hasn't happened → breached.
  const firstResponseOverdue =
    input.firstResponseDueAt !== null &&
    input.firstResponseAt === null &&
    input.firstResponseDueAt.getTime() < nowMs
  const resolutionOverdue =
    input.resolutionDueAt !== null &&
    input.resolvedAt === null &&
    input.resolutionDueAt.getTime() < nowMs
  if (firstResponseOverdue || resolutionOverdue) return 'breached'

  // If no deadlines apply (no SLA policy or all satisfied), on-track.
  const activeDeadlines: Array<{ dueAt: Date; targetMinutes: number }> = []
  if (
    input.firstResponseDueAt !== null &&
    input.firstResponseAt === null &&
    input.targetResponseMinutes !== null
  ) {
    activeDeadlines.push({
      dueAt: input.firstResponseDueAt,
      targetMinutes: input.targetResponseMinutes,
    })
  }
  if (
    input.resolutionDueAt !== null &&
    input.resolvedAt === null &&
    input.targetResolutionMinutes !== null
  ) {
    activeDeadlines.push({
      dueAt: input.resolutionDueAt,
      targetMinutes: input.targetResolutionMinutes,
    })
  }
  if (activeDeadlines.length === 0) return 'on-track'

  // At-risk if any active deadline has less than 25% of its
  // original window remaining. Compares remaining-vs-total
  // per deadline so a 4h and 24h SLA use their own thresholds.
  for (const d of activeDeadlines) {
    const totalWindowMs = d.targetMinutes * 60 * 1000
    const remainingMs = d.dueAt.getTime() - nowMs
    if (remainingMs / totalWindowMs < AT_RISK_THRESHOLD) return 'at-risk'
  }
  return 'on-track'
}

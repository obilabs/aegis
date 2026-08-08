import { pool } from '@/lib/db'

export type ChangeSource = 'user' | 'system' | 'automation' | 'ai'

export interface FieldChange {
  fieldName: string
  oldValue: string | null
  newValue: string | null
}

/**
 * Log a single field change to the append-only ticket_field_changes table.
 * Used for SOC2 CC8.1 compliance — every field mutation is tracked.
 */
export async function logTicketFieldChange(
  organizationId: string,
  ticketId: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy: string,
  source: ChangeSource = 'user',
  reason?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO ticket_field_changes
     (organization_id, ticket_id, field_name, old_value, new_value, changed_by, change_source, change_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [organizationId, ticketId, fieldName, oldValue, newValue, changedBy, source, reason || null]
  )
}

/**
 * Log multiple field changes in a single query (batch insert).
 * Used when a PUT request updates multiple fields at once.
 */
export async function logTicketFieldChanges(
  organizationId: string,
  ticketId: string,
  changes: FieldChange[],
  changedBy: string,
  source: ChangeSource = 'user',
  reason?: string
): Promise<void> {
  if (changes.length === 0) return

  const values: unknown[] = []
  const placeholders: string[] = []
  let paramIndex = 1

  for (const change of changes) {
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
    )
    values.push(
      organizationId,
      ticketId,
      change.fieldName,
      change.oldValue,
      change.newValue,
      changedBy,
      source,
      reason || null
    )
    paramIndex += 8
  }

  await pool.query(
    `INSERT INTO ticket_field_changes
     (organization_id, ticket_id, field_name, old_value, new_value, changed_by, change_source, change_reason)
     VALUES ${placeholders.join(', ')}`,
    values
  )
}

/**
 * Compare old and new ticket objects, returning only the fields that changed.
 * Handles string, number, boolean, and null values.
 * Ignores 'updated_at' to avoid noise.
 */
export function diffTicketFields(
  oldTicket: Record<string, unknown>,
  newFields: Record<string, unknown>,
  trackedFields: string[]
): FieldChange[] {
  const changes: FieldChange[] = []

  for (const field of trackedFields) {
    if (!(field in newFields)) continue

    const oldVal = oldTicket[field]
    const newVal = newFields[field]

    const oldStr = oldVal == null ? null : String(oldVal)
    const newStr = newVal == null ? null : String(newVal)

    if (oldStr !== newStr) {
      changes.push({
        fieldName: field,
        oldValue: oldStr,
        newValue: newStr,
      })
    }
  }

  return changes
}

/** Fields tracked for audit trail on ticket updates */
export const TRACKED_TICKET_FIELDS = [
  'status_id',
  'priority',
  'category_id',
  'assigned_to',
  'assigned_team',
  'subject',
  'description',
  'type',
  'type_id',
  'request_category',
  'root_cause',
  'resolution_steps',
  'resolution_category',
  'approved_at',
  'approved_by',
  'resolved_at',
  'closed_at',
]

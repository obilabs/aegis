import { pool } from '@/lib/db'
import { getTicketAccessFilter } from '@/lib/permissions'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The ticket, if the caller may see it. Uses the same ticket_access scoping as
 * the ticket detail read, so attachments are never visible to someone who
 * cannot open the ticket (and a hidden ticket reads as not found).
 */
export async function findAccessibleTicket(
  ticketId: string,
  userId: string,
  orgId: string,
): Promise<{ id: string; subject: string } | null> {
  if (!UUID_RE.test(ticketId)) return null
  const access = await getTicketAccessFilter(userId, orgId, 't', 3)
  const res = await pool.query(
    `SELECT t.id, t.subject FROM tickets t
      WHERE t.id = $1 AND t.organization_id = $2 AND t.is_deleted = false ${access.clause}`,
    [ticketId, orgId, ...access.params],
  )
  return res.rows[0] ?? null
}

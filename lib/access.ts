/**
 * Route guards for internal (session-authenticated) API routes.
 *
 * Every route under app/api/portal, app/api/settings, app/api/admin and
 * app/api/ai must either call one of these (or another guard listed in
 * lib/route-guards.test.ts) or be listed there with a reason. The test fails
 * when a route is added without either.
 *
 * Roles resolve to three levels (lib/permissions.ts):
 *   - admin: role with admin_access
 *   - staff: admin, or ticket_access "team"/"all" (technicians, helpdesk, managers)
 *   - end user: ticket_access "own" — their own tickets, the KB, their account
 *
 * Each guard returns a context on success or a NextResponse to return as-is:
 *
 *   const ctx = await requireStaff(request)
 *   if (ctx instanceof NextResponse) return ctx
 */

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'
import {
  getTicketAccessFilter,
  getUserPermissions,
  type Capability,
  type UserPermissions,
} from '@/lib/permissions'
import { findAccessibleTicket } from '@/lib/ticket-attachments'

export interface AccessContext {
  userId: string
  orgId: string
  email: string
  perms: UserPermissions
}

export { accessLevel, allows, type AccessLevel } from '@/lib/access-policy'
import { allows } from '@/lib/access-policy'

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 })

/** Any signed-in user with an application account in this organization. */
export async function requireUser(request: Request): Promise<AccessContext | NextResponse> {
  let ctx
  try {
    ctx = await getAuthContext(request)
  } catch {
    return forbidden('No application account for this session')
  }
  if (!ctx) return unauthorized()
  const perms = await getUserPermissions(ctx.userId)
  return { userId: ctx.userId, orgId: ctx.orgId, email: ctx.session.user.email, perms }
}

/** Staff: admin, or a role that works tickets beyond its own. */
export async function requireStaff(request: Request): Promise<AccessContext | NextResponse> {
  const ctx = await requireUser(request)
  if (ctx instanceof NextResponse) return ctx
  return allows(ctx.perms, { level: 'staff' }) ? ctx : forbidden('Staff access required')
}

/** Admin, or any role holding the capability. */
export async function requireCapability(
  request: Request,
  capability: Capability,
): Promise<AccessContext | NextResponse> {
  const ctx = await requireUser(request)
  if (ctx instanceof NextResponse) return ctx
  return allows(ctx.perms, { capability }) ? ctx : forbidden(`Requires ${capability} capability`)
}

/**
 * The ticket must be inside the caller's ticket_access scope (same filter as
 * the ticket read). Out of scope reads as not found. `staffOnly` additionally
 * refuses end users (for actions such as claiming or editing tasks).
 */
export async function requireTicketAccess(
  request: Request,
  ticketId: string,
  opts: { staffOnly?: boolean } = {},
): Promise<AccessContext | NextResponse> {
  const ctx = await requireUser(request)
  if (ctx instanceof NextResponse) return ctx
  const ticket = await findAccessibleTicket(ticketId, ctx.userId, ctx.orgId)
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  if (opts.staffOnly && !allows(ctx.perms, { level: 'staff' })) {
    return forbidden('Staff access required')
  }
  return ctx
}

/** SQL clause scoping a tickets alias to the caller (re-exported for list routes). */
export { getTicketAccessFilter }

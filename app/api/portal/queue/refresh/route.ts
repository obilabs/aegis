import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { hasCapability } from '@/lib/permissions'
import { NextResponse } from 'next/server'

/**
 * POST /api/portal/queue/refresh
 *
 * Triggers a full re-score of all open tickets. Requires triage capability.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

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

    // Enqueue a sweep job
    const { getQueue } = await import('@/lib/queue')
    const queue = await getQueue()
    await queue.send('ticket.triage.sweep', { manual: true, triggeredBy: itsmUser.id })

    return NextResponse.json({ success: true, message: 'Queue refresh triggered' })
  } catch (error) {
    console.error('Error refreshing queue:', error)
    return NextResponse.json({ error: 'Failed to refresh queue' }, { status: 500 })
  }
}

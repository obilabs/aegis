import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

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
    const orgId = await getOrgId()

    // Verify group belongs to organization
    const groupCheck = await pool.query(
      'SELECT id FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Trigger rule evaluation via database function
    const result = await pool.query(
      'SELECT * FROM evaluate_dynamic_group($1)',
      [id]
    )

    const evaluation = result.rows[0] || { added: 0, removed: 0, unchanged: 0 }

    return NextResponse.json({
      added: evaluation.added || 0,
      removed: evaluation.removed || 0,
      unchanged: evaluation.unchanged || 0,
    })
  } catch (error) {
    console.error('Error evaluating group:', error)
    return NextResponse.json({ error: 'Failed to evaluate group' }, { status: 500 })
  }
}

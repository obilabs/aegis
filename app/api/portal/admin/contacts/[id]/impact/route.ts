import { auth } from '@/lib/auth'
import { isAdminRequest } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

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
    const orgId = await getOrgId()

    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify contact belongs to org
    const contactCheck = await pool.query(
      'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )
    if (contactCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const result = await pool.query(
      'SELECT contact_deletion_impact($1) as impact',
      [id]
    )

    return NextResponse.json({ impact: result.rows[0].impact })
  } catch (error) {
    console.error('Error fetching deletion impact:', error)
    return NextResponse.json({ error: 'Failed to fetch deletion impact' }, { status: 500 })
  }
}

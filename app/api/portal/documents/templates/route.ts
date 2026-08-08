import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const templates = await query(
      `SELECT id, name, description, category, content, created_at
       FROM document_templates
       WHERE organization_id = $1 AND is_active = true
       ORDER BY category, name`,
      [orgId]
    )

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Failed to fetch templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

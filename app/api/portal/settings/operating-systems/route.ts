import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    let queryText = `SELECT * FROM operating_systems WHERE organization_id = $1`
    const values: any[] = [orgId]

    if (platform) {
      queryText += ` AND platform = $2`
      values.push(platform)
    }

    queryText += ` ORDER BY sort_order, name`

    const result = await pool.query(queryText, values)

    return NextResponse.json({ operatingSystems: result.rows })
  } catch (error) {
    console.error('Error fetching operating systems:', error)
    return NextResponse.json({ error: 'Failed to fetch operating systems' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const body = await request.json()

    if (!body.platform?.trim()) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO operating_systems (organization_id, platform, name, version, build)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      orgId,
      body.platform.trim(),
      body.name.trim(),
      body.version?.trim() || null,
      body.build?.trim() || null,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'An operating system with this name already exists' }, { status: 409 })
    }
    console.error('Error creating operating system:', error)
    return NextResponse.json({ error: 'Failed to create operating system' }, { status: 500 })
  }
}

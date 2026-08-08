import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  icon: z.string().max(50).optional(),
})

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const folders = await query(
      `SELECT f.id, f.name, f.description, f.parent_id, f.icon, f.display_order,
        COUNT(d.id)::int AS document_count
       FROM folders f
       LEFT JOIN documents d ON d.folder_id = f.id AND d.is_deleted = false
       WHERE f.organization_id = $1
       GROUP BY f.id, f.name, f.description, f.parent_id, f.icon, f.display_order
       ORDER BY f.display_order, f.name`,
      [orgId]
    )

    return NextResponse.json({ folders })
  } catch (error) {
    console.error('Failed to fetch folders:', error)
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const body = await request.json()
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  try {
    const result = await query(
      `INSERT INTO folders (organization_id, name, description, parent_id, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, created_at`,
      [orgId, d.name, d.description || null, d.parentId || null, d.icon || null]
    )

    return NextResponse.json({ folder: result[0] }, { status: 201 })
  } catch (error) {
    console.error('Failed to create folder:', error)
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
  }
}

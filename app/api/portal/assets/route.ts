import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { getUserPermissions } from '@/lib/permissions'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const ASSET_STATUSES = ['active', 'deployed', 'storage', 'retired', 'disposed'] as const

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform(v => (v ? v : null))

const createAssetSchema = z.object({
  name: z.string().trim().min(1).max(255),
  asset_tag: optionalText(100),
  type_id: z.string().uuid().optional().nullable(),
  make: optionalText(100),
  model: optionalText(100),
  serial_number: optionalText(100),
  hostname: optionalText(255),
  status: z.enum(ASSET_STATUSES).default('active'),
  company_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  warranty_expire: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('').transform(() => null)),
  notes: z.string().max(10_000).optional().nullable(),
})

/**
 * POST /api/portal/assets: create an asset.
 *
 * Staff only (a role with admin access or team/all ticket access); end users
 * with "own" access cannot add inventory. Referenced type, company and contact
 * must belong to this organization.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const perms = await getUserPermissions(ctx.userId)
    if (!perms.adminAccess && perms.ticketAccess === 'own') {
      return NextResponse.json({ error: 'Only staff can add assets' }, { status: 403 })
    }

    const parsed = createAssetSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const refs: Array<[string, string | null | undefined, string]> = [
      ['asset_types', data.type_id, 'Asset type'],
      ['companies', data.company_id, 'Company'],
      ['contacts', data.contact_id, 'Contact'],
    ]
    for (const [table, id, label] of refs) {
      if (!id) continue
      const found = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1 AND organization_id = $2`, [id, ctx.orgId])
      if (found.rows.length === 0) {
        return NextResponse.json({ error: `${label} not found` }, { status: 400 })
      }
    }

    const result = await pool.query(
      `INSERT INTO assets (
         organization_id, name, asset_tag, type_id, make, model, serial_number,
         hostname, status, company_id, contact_id, warranty_expire, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, name, asset_tag, status, created_at`,
      [
        ctx.orgId, data.name, data.asset_tag, data.type_id || null, data.make, data.model,
        data.serial_number, data.hostname, data.status, data.company_id || null,
        data.contact_id || null, data.warranty_expire || null, data.notes?.trim() || null,
      ],
    )
    const asset = result.rows[0]

    logAudit({
      orgId: ctx.orgId, userId: ctx.userId, action: 'asset_created', actionCategory: 'create',
      entityType: 'assets', entityId: asset.id, entityName: asset.name,
      newValues: data,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error('Error creating asset:', error)
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const result = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.asset_tag,
        COALESCE(at.name, a.type_id::text) as type,
        a.make,
        a.model,
        a.serial_number,
        a.status,
        CONCAT(c.first_name, ' ', c.last_name) as assigned_to,
        c.is_deleted as contact_is_deleted,
        COALESCE(l.name, a.physical_location) as location,
        a.primary_ip,
        a.os,
        a.warranty_expire,
        a.updated_at
      FROM assets a
      LEFT JOIN asset_types at ON a.type_id = at.id
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.organization_id = $1
        AND a.is_deleted = false
      ORDER BY a.updated_at DESC
    `, [orgId])

    return NextResponse.json({ assets: result.rows })
  } catch (error) {
    console.error('Error fetching assets:', error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}

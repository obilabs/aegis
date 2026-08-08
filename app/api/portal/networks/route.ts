import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  network: z.string().min(1), // CIDR notation
  gateway: z.string().max(45).optional(),
  subnetMask: z.string().max(45).optional(),
  dhcpEnabled: z.boolean().optional(),
  dhcpStart: z.string().max(45).optional(),
  dhcpEnd: z.string().max(45).optional(),
  dhcpServer: z.string().max(45).optional(),
  dnsServers: z.array(z.string()).optional(),
  vlanId: z.number().int().optional(),
  vlanName: z.string().max(100).optional(),
  companyId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const rows = await query(
      `SELECT
        n.id, n.name, n.description, n.network, n.gateway, n.subnet_mask,
        n.dhcp_enabled, n.dhcp_start, n.dhcp_end, n.dhcp_server,
        n.dns_servers, n.vlan_id, n.vlan_name, n.notes,
        n.is_active, n.company_id, n.location_id,
        n.created_at, n.updated_at,
        co.name AS company_name,
        l.name AS location_name
      FROM networks n
      LEFT JOIN companies co ON n.company_id = co.id
      LEFT JOIN locations l ON n.location_id = l.id
      WHERE n.organization_id = $1
      ORDER BY n.name`,
      [orgId]
    )

    return NextResponse.json({ networks: rows })
  } catch (error) {
    console.error('Failed to fetch networks:', error)
    return NextResponse.json({ error: 'Failed to fetch networks' }, { status: 500 })
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
      `INSERT INTO networks (
        organization_id, name, description, network, gateway, subnet_mask,
        dhcp_enabled, dhcp_start, dhcp_end, dhcp_server, dns_servers,
        vlan_id, vlan_name, company_id, location_id, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id, name, created_at`,
      [
        orgId, d.name, d.description || null, d.network, d.gateway || null, d.subnetMask || null,
        d.dhcpEnabled || false, d.dhcpStart || null, d.dhcpEnd || null, d.dhcpServer || null,
        d.dnsServers || [], d.vlanId || null, d.vlanName || null,
        d.companyId || null, d.locationId || null, d.notes || null,
      ]
    )

    return NextResponse.json({ network: result[0] }, { status: 201 })
  } catch (error) {
    console.error('Failed to create network:', error)
    return NextResponse.json({ error: 'Failed to create network' }, { status: 500 })
  }
}

import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId

    await pool.query(`SELECT seed_asset_master_data($1)`, [orgId])

    return NextResponse.json({ success: true, message: 'Asset master data seeded successfully' })
  } catch (error) {
    console.error('Error seeding asset master data:', error)
    return NextResponse.json({ error: 'Failed to seed asset master data' }, { status: 500 })
  }
}

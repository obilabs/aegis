import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/access'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const org = await queryOne<{ portal_guidance_enabled: boolean }>(
      'SELECT COALESCE(portal_guidance_enabled, true) as portal_guidance_enabled FROM organizations WHERE id = $1',
      [orgId]
    )

    return NextResponse.json({
      portal_guidance_enabled: org?.portal_guidance_enabled ?? true,
    })
  } catch (error) {
    console.error('Error fetching portal settings:', error)
    return NextResponse.json({ error: 'Failed to fetch portal settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can change portal settings
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const orgId = await getOrgId()
    const body = await request.json()

    if (typeof body.portal_guidance_enabled === 'boolean') {
      await queryOne(
        'UPDATE organizations SET portal_guidance_enabled = $1 WHERE id = $2 RETURNING id',
        [body.portal_guidance_enabled, orgId]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating portal settings:', error)
    return NextResponse.json({ error: 'Failed to update portal settings' }, { status: 500 })
  }
}

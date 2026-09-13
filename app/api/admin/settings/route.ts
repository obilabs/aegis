import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/access'
import { query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'

interface SiteSetting {
  key: string
  value: string
  description: string | null
  updated_at: Date
}

// GET - fetch all settings
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)

  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { session, orgId } = ctx

  // Verify admin role
  if (!(await isAdminRequest(request))) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Admin access required' },
      { status: 403 }
    )
  }

  try {
    const settings = await query<SiteSetting>(
      `SELECT key, value, description, updated_at FROM site_settings WHERE organization_id = $1 ORDER BY key`,
      [orgId]
    )

    // Convert to object for easier access
    const settingsMap: Record<string, string> = {}
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value
    }

    return NextResponse.json({
      success: true,
      data: {
        settings: settingsMap,
        raw: settings,
      },
    })
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT - update a setting
export async function PUT(request: NextRequest) {
  const ctx = await getAuthContext(request)

  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { session, userId, orgId } = ctx

  // Verify admin role
  if (!(await isAdminRequest(request))) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Admin access required' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Key and value are required' },
        { status: 400 }
      )
    }

    // Validate specific settings
    if (key === 'estimated_monthly_costs_cents') {
      const cents = parseInt(value, 10)
      if (isNaN(cents) || cents < 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid cost amount' },
          { status: 400 }
        )
      }
    }

    await query(
      `INSERT INTO site_settings (organization_id, key, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (organization_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
      [orgId, key, String(value)]
    )
    logAudit({
      orgId, userId, action: 'setting_updated', actionCategory: 'settings',
      entityType: 'settings', entityName: key,
      newValues: { key, value: String(value) },
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({
      success: true,
      message: 'Setting updated',
    })
  } catch (error) {
    console.error('Failed to update setting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update setting' },
      { status: 500 }
    )
  }
}

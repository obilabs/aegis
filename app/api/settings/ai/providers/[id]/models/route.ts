import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAdmin } from '@/lib/require-admin'

// POST - Add model to provider
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authorization (audit C2): managing a provider's models is admin-only.
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const { id: providerId } = await params
    const body = await request.json()
    const { model_name, display_name, use_case = 'general', is_default = false } = body

    if (!model_name) {
      return NextResponse.json(
        { success: false, error: 'Model name is required' },
        { status: 400 }
      )
    }

    const orgId = admin.orgId

    // Verify provider belongs to organization
    const providers = await query(
      'SELECT id FROM ai_providers WHERE id = $1 AND organization_id = $2',
      [providerId, orgId]
    )

    if (providers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // If this is default, unset other defaults
    if (is_default) {
      await query(
        'UPDATE ai_models SET is_default = false WHERE provider_id = $1',
        [providerId]
      )
    }

    // Insert model
    const result = await query(
      `INSERT INTO ai_models (
        provider_id,
        model_name,
        display_name,
        use_case,
        is_default,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, model_name, display_name, use_case, is_default, is_active`,
      [providerId, model_name, display_name || model_name, use_case, is_default]
    )

    return NextResponse.json({ success: true, data: result[0] })
  } catch (error) {
    console.error('Error adding model:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add model' },
      { status: 500 }
    )
  }
}

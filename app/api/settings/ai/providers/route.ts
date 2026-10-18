import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'

// GET - List all AI providers
export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const orgId = await getOrgId()

    const providers = await query(
      `SELECT
        id,
        name,
        provider_type as type,
        api_url,
        is_local,
        is_active,
        is_default,
        COALESCE(last_connection_status, 'unknown') as last_connection_status,
        last_connection_at,
        created_at
       FROM ai_providers
       WHERE organization_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [orgId]
    )

    // Get models for each provider
    const providersWithModels = await Promise.all(
      providers.map(async (provider: any) => {
        const models = await query(
          `SELECT
            id,
            model_name,
            display_name,
            use_case,
            is_default,
            is_active
           FROM ai_models
           WHERE provider_id = $1
           ORDER BY is_default DESC, model_name`,
          [provider.id]
        )
        return {
          ...provider,
          models,
          status: provider.last_connection_status || 'unknown',
        }
      })
    )

    return NextResponse.json({ success: true, data: providersWithModels })
  } catch (error) {
    console.error('Error fetching AI providers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch providers' },
      { status: 500 }
    )
  }
}

// POST - Add new AI provider
export async function POST(request: NextRequest) {
  // Authorization (audit C2): creating AI providers is admin-only — a created
  // provider's api_url becomes the target of the /test SSRF surface and the
  // active endpoint every future prompt is sent to.
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const body = await request.json()
    const { name, type, api_url, api_key } = body

    if (!name || !type || !api_url) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const orgId = admin.orgId
    const isLocal = type === 'ollama'

    // Check if this is the first provider (make it default)
    const existingProviders = await query(
      'SELECT COUNT(*) as count FROM ai_providers WHERE organization_id = $1',
      [orgId]
    )
    const isDefault = parseInt(existingProviders[0]?.count || '0') === 0

    // Insert provider
    const result = await query(
      `INSERT INTO ai_providers (
        organization_id,
        name,
        provider_type,
        api_url,
        api_key_encrypted,
        is_local,
        is_active,
        is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING id, name, provider_type as type, api_url, is_local, is_active, is_default`,
      [orgId, name, type, api_url, api_key || null, isLocal, isDefault]
    )

    return NextResponse.json({
      success: true,
      data: { ...result[0], models: [], status: 'unknown' }
    })
  } catch (error) {
    console.error('Error creating AI provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create provider' },
      { status: 500 }
    )
  }
}

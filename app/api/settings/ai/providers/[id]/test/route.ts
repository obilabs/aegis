import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { assertSafeFetchTarget } from '@/lib/ssrf-guard'
import { logAudit, getClientIp } from '@/lib/audit'
import { headers } from 'next/headers'

// POST - Test connection to AI provider
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  // Authorization (audit C2): testing an AI provider issues a server-side
  // fetch to the stored api_url with the stored api_key. Admin-only — without
  // this, any authenticated user could use it as an SSRF/exfil channel.
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { id } = await params

    // Get provider details
    const providers = await query(
      `SELECT id, name, provider_type as type, api_url, api_key_encrypted as api_key, is_local
       FROM ai_providers 
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (providers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    const provider = providers[0]

    // SSRF guard (audit C2): validate the outbound target before fetching.
    // Local providers (Ollama) may legitimately use a LAN/loopback endpoint,
    // so `allowPrivate` follows `is_local`; link-local / cloud-metadata is
    // blocked for everyone.
    try {
      await assertSafeFetchTarget(provider.api_url, { allowPrivate: provider.is_local })
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: e?.message || 'Blocked provider URL' },
        { status: 400 },
      )
    }

    let connected = false
    let models: string[] = []
    let error: string | null = null

    // Test connection based on provider type
    if (provider.type === 'ollama') {
      try {
        // Test Ollama connection by listing models
        const response = await fetch(`${provider.api_url}/api/tags`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        })

        if (response.ok) {
          const data = await response.json()
          connected = true
          models = data.models?.map((m: any) => m.name) || []
        } else {
          error = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (e: any) {
        error = e.message || 'Connection failed'
      }
    } else if (provider.type === 'openai') {
      try {
        const response = await fetch(`${provider.api_url}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${provider.api_key}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        })

        if (response.ok) {
          const data = await response.json()
          connected = true
          models = data.data?.slice(0, 10).map((m: any) => m.id) || []
        } else {
          error = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (e: any) {
        error = e.message || 'Connection failed'
      }
    } else if (provider.type === 'google') {
      try {
        const response = await fetch(
          `${provider.api_url}/models?key=${provider.api_key}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
          }
        )

        if (response.ok) {
          const data = await response.json()
          connected = true
          models = data.models?.slice(0, 10).map((m: any) => m.name.replace('models/', '')) || []
        } else {
          error = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (e: any) {
        error = e.message || 'Connection failed'
      }
    } else {
      // For custom/other providers, just try a simple request
      try {
        const response = await fetch(`${provider.api_url}/models`, {
          method: 'GET',
          headers: provider.api_key ? {
            'Authorization': `Bearer ${provider.api_key}`,
            'Content-Type': 'application/json',
          } : { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000),
        })

        connected = response.ok
        if (!response.ok) {
          error = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (e: any) {
        error = e.message || 'Connection failed'
      }
    }

    // Persist connection status to database
    try {
      await query(
        `UPDATE ai_providers
         SET last_connection_status = $1,
             last_connection_at = NOW(),
             last_connection_error = $2
         WHERE id = $3 AND organization_id = $4`,
        [connected ? 'connected' : 'error', error, id, orgId]
      )
    } catch {
      // Column may not exist yet if migration hasn't run
    }

    logAudit({
      orgId, userId, action: 'ai_provider_tested', actionCategory: 'view',
      entityType: 'ai_providers', entityId: id,
      entityName: provider.name,
      newValues: { providerType: provider.type, connected, modelCount: models.length },
      actorIp: getClientIp(await headers()),
    })

    return NextResponse.json({
      success: true,
      data: {
        connected,
        models,
        error,
      },
    })
  } catch (error) {
    console.error('Error testing AI provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to test provider' },
      { status: 500 }
    )
  }
}

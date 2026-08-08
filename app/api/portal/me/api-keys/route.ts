/**
 * Self-service personal API keys.
 *
 * GET  /api/portal/me/api-keys — list THIS user's personal keys.
 * POST /api/portal/me/api-keys — issue a personal key for THIS user.
 *
 * Spec: openspec/changes/api-keys-typed-scoped (D4 self-service +
 * scope ceiling + quota).
 *
 * Session auth, NO admin check — any authenticated user can manage
 * their own personal keys. The two security boundaries here:
 *
 *   1. **Quota** — `PERSONAL_KEY_QUOTA` (5) non-revoked personal keys
 *      per user. Revoked keys don't count.
 *   2. **Scope ceiling** — `userMaxScopes(userId)` is derived from the
 *      user's role capabilities. A user can never grant scopes that
 *      exceed their own in-app permissions; requested scopes outside
 *      the ceiling are silently dropped from the granted set and
 *      surfaced in the response as `dropped` so the UI can warn.
 *
 * The admin-issued types (mtp-polling, delegated-write) go through
 * `/api/settings/api-keys` instead — different surface, different
 * audit contract.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { API_SCOPE_LIST, type ApiScope } from '@obilabs/api-scopes'
import { queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { generateApiKey } from '@/lib/api-keys'
import {
  PERSONAL_KEY_QUOTA,
  intersectScopes,
  personalKeysForUser,
  userMaxScopes,
} from '@/lib/api-key-scopes'

// `getAuthContext` throws when no org row exists. Same 412 convention
// as `/api/settings/api-keys`.
function isNoOrgError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('No organization found')
}
function noOrgResponse() {
  return NextResponse.json(
    {
      error: 'setup-not-completed',
      message: 'Run the setup wizard before creating API keys.',
      setupUrl: '/portal/setup/wizard',
    },
    { status: 412 },
  )
}

// ---------------------------------------------------------------------------
// GET — this user's personal keys (never returns hash or full key)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { userId } = ctx
    const { count, keys } = await personalKeysForUser(userId)
    const ceiling = await userMaxScopes(userId)
    return NextResponse.json({
      apiKeys: keys,
      quota: { used: count, max: PERSONAL_KEY_QUOTA },
      maxScopes: ceiling,
    })
  } catch (error) {
    if (isNoOrgError(error)) return noOrgResponse()
    console.error('Failed to list personal API keys:', error)
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — create a personal key for THIS user
// ---------------------------------------------------------------------------

const ApiScopeEnum = z.enum(API_SCOPE_LIST as [ApiScope, ...ApiScope[]])

const CreatePersonalKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(ApiScopeEnum).min(1, 'At least one scope is required'),
  // 1-365 days. The DB default is 90 — keep parity here so the UI can
  // omit the field and get the same default the admin form does.
  expires_in_days: z.number().int().min(1).max(365).default(90),
})

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { userId, orgId } = ctx

    const body = await request.json()
    const parsed = CreatePersonalKeySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { name, scopes: requested, expires_in_days } = parsed.data

    // Quota first — cheap check, fails fast before key generation.
    const { count } = await personalKeysForUser(userId)
    if (count >= PERSONAL_KEY_QUOTA) {
      return NextResponse.json(
        {
          error: 'quota-exceeded',
          message: `You already have ${PERSONAL_KEY_QUOTA} active personal keys. Revoke one before creating another.`,
          quota: { used: count, max: PERSONAL_KEY_QUOTA },
        },
        { status: 409 },
      )
    }

    // Ceiling check. Drop scopes the user can't grant; tell the UI
    // which ones we dropped so it can show a "we removed these" hint.
    const ceiling = await userMaxScopes(userId)
    const { granted, dropped } = intersectScopes(requested, ceiling)
    if (granted.length === 0) {
      return NextResponse.json(
        {
          error: 'no-grantable-scopes',
          message:
            'None of the requested scopes are within your role permissions. Ask an admin to widen your role or pick from your allowed scopes.',
          requested,
          maxScopes: ceiling,
        },
        { status: 403 },
      )
    }

    const { fullKey, prefix, hash } = generateApiKey()
    const expiresAt = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)

    // Write canonical scopes into BOTH `scopes` (text[], read by
    // lib/api-auth.ts) and `permissions` (jsonb, read by today's
    // admin list UI). Chunk 4 collapses the UI to a single column;
    // keeping both in sync now means the legacy list view still
    // renders something coherent for these new keys.
    const row = await queryOne(
      `INSERT INTO api_keys
         (organization_id, name, key_hash, key_prefix,
          permissions, scopes,
          rate_limit, expires_at, ai_context_level,
          key_type, key_owner_user_id, created_by)
       VALUES ($1, $2, $3, $4,
               $5::jsonb, $6::text[],
               $7, $8, $9,
               'personal', $10, $10)
       RETURNING id, name, key_prefix, scopes, permissions, rate_limit,
                 expires_at, ai_context_level, key_type, key_owner_user_id,
                 created_at`,
      [
        orgId,
        name,
        hash,
        prefix,
        JSON.stringify(granted),
        granted,
        500,
        expiresAt.toISOString(),
        'end_user',
        userId,
      ],
    )

    return NextResponse.json(
      {
        ...row,
        api_key: fullKey,
        granted,
        dropped,
        message:
          dropped.length > 0
            ? `Store this key securely — it will not be shown again. ${dropped.length} requested scope(s) were not granted because they exceed your role permissions.`
            : 'Store this key securely. It will not be shown again.',
      },
      { status: 201 },
    )
  } catch (error) {
    if (isNoOrgError(error)) return noOrgResponse()
    console.error('Failed to create personal API key:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}

/**
 * Admin API Keys — list (all) & create (any type).
 *
 * GET  /api/settings/api-keys — list every key in the org with owner
 *                               info, type, and migration status.
 * POST /api/settings/api-keys — admin-issued key of any of the three
 *                               typed flavors.
 *
 * Spec: openspec/changes/api-keys-typed-scoped (D2 + D4 + D5).
 *
 * Type semantics:
 *   - personal           → bound to a user; scopes capped by THAT user's
 *                          ceiling (admin can't grant scopes the owner
 *                          doesn't have in-app); counts toward owner's
 *                          quota.
 *   - mtp-polling        → org-owned, read-only by convention (admin
 *                          picks scopes; we don't enforce read-only).
 *   - delegated-write    → org-owned; bearer auths the firm, per-call
 *                          headers carry the actor assertion. Header
 *                          enforcement lives in `requireScope`, not
 *                          here.
 *
 * Full key is returned exactly once on creation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { API_SCOPE_LIST, type ApiScope } from '@obilabs/api-scopes'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { generateApiKey } from '@/lib/api-keys'
import { issuePairing } from '@/lib/mtp-pairings'

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
// GET — list every key in the org (admin view)
// ---------------------------------------------------------------------------
//
// JOIN users to surface the owner email for personal keys (NULL for
// org-owned types). Returns canonical `scopes` text[] going forward;
// the legacy `permissions` JSONB column is kept in the payload for the
// transition window so a browser tab open during the rollout doesn't
// blank out — the migration backfilled `scopes` from `permissions` and
// new writes set both.

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { orgId } = ctx
    // DB-backed admin check (isAdmin) — NOT session.user.role, which is stale
    // under cookieCache after the setup wizard promotes the first user (session
    // was minted at signup with role='user'). This is why a freshly-set-up
    // admin got "Admin access required" on MTP Pairing until re-login.
    if (!(await isAdmin(ctx.userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const keys = await query(
      `SELECT k.id, k.name, k.key_prefix, k.permissions, k.scopes,
              k.rate_limit, k.expires_at, k.last_used_at, k.is_active,
              k.ai_context_level, k.created_at, k.created_by,
              k.key_type, k.key_owner_user_id, k.migrated_at,
              k.pairing_window_expires_at, k.paired_at,
              k.paired_from_ip, k.paired_user_agent,
              owner.email AS key_owner_email,
              NULLIF(TRIM(BOTH FROM CONCAT(owner.first_name, ' ', owner.last_name)), '')
                          AS key_owner_name
         FROM api_keys k
         LEFT JOIN users owner ON owner.id = k.key_owner_user_id
        WHERE k.organization_id = $1
        ORDER BY k.created_at DESC`,
      [orgId],
    )

    // Per-org migration banner state — surfaces alongside the list so
    // the UI doesn't need a separate round-trip.
    const banner = await queryOne<{
      pending: number
      dismissed_at: string | null
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM api_keys
            WHERE organization_id = $1 AND migrated_at IS NOT NULL)
         AS pending,
         (SELECT migration_banner_dismissed_at FROM organizations
            WHERE id = $1)
         AS dismissed_at`,
      [orgId],
    )

    return NextResponse.json({
      apiKeys: keys,
      migration: {
        pendingVerification: banner?.pending ?? 0,
        dismissedAt: banner?.dismissed_at ?? null,
      },
    })
  } catch (error) {
    if (isNoOrgError(error)) return noOrgResponse()
    console.error('Failed to list API keys:', error)
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — admin issues a key of any type
// ---------------------------------------------------------------------------

const ApiScopeEnum = z.enum(API_SCOPE_LIST as [ApiScope, ...ApiScope[]])

// Personal keys are self-service ONLY (POST /api/portal/me/api-keys).
// Admin-issued keys are always org-owned — never personal-on-behalf —
// so the owner remains the sole authority for their own automation
// creds. Schema enforces that even before the route logic.
const CreateKeySchema = z.discriminatedUnion('key_type', [
  // MTP polling — org-owned, no actor binding.
  z.object({
    key_type: z.literal('mtp-polling'),
    name: z.string().min(1).max(100),
    scopes: z.array(ApiScopeEnum).min(1),
    rate_limit: z.number().int().min(0).max(100000).default(500),
    expires_in_days: z.number().int().min(1).max(365).default(90),
    ai_context_level: z.enum(['end_user', 'technician', 'admin']).default('technician'),
  }),
  // Delegated-write — org-owned, per-call headers required at the
  // requireScope chokepoint. Admin records the partner label for
  // forensic context (free-text, surfaced in audit).
  z.object({
    key_type: z.literal('delegated-write'),
    name: z.string().min(1).max(100),
    scopes: z.array(ApiScopeEnum).min(1),
    partner_label: z.string().min(1).max(120).optional(),
    rate_limit: z.number().int().min(0).max(100000).default(500),
    expires_in_days: z.number().int().min(1).max(365).default(90),
    ai_context_level: z.enum(['end_user', 'technician', 'admin']).default('admin'),
  }),
  // Aegis-MTP pairing — org-owned. Bespoke 15-minute pairing window
  // + single-use binding contract per api-keys-mtp-unification.
  // Scopes are CUSTOMER-CHOSEN — the customer decides what the
  // bound MTP can read/write/delete. Default at creation is
  // ['tickets:read'] but the picker lets them grant more. The
  // pairing window + single-use binding (key security) and the
  // scope set (authorization) are orthogonal axes — security
  // mechanics here, scope authority via the standard scopes array.
  // Window is set to NOW() + 15 minutes inside issuePairing(); no
  // expires_in_days field (pairing keys don't have an expiry — they
  // expire by being revoked, not by clock).
  z.object({
    key_type: z.literal('aegis-mtp-pairing'),
    name: z.string().min(1).max(100),
    scopes: z.array(ApiScopeEnum).min(1),
  }),
])

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { userId, orgId } = ctx
    // DB-backed admin check (isAdmin) — NOT session.user.role, which is stale
    // under cookieCache after the setup wizard promotes the first user (session
    // was minted at signup with role='user'). This is why a freshly-set-up
    // admin got "Admin access required" on MTP Pairing until re-login.
    if (!(await isAdmin(ctx.userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = CreateKeySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const data = parsed.data

    // aegis-mtp-pairing routes through the bespoke issuePairing()
    // helper because the pairing contract (mtp_pair_* prefix, 15-min
    // window column, atomic-claim-friendly INSERT) is distinct from
    // the generic admin INSERT path. Apps/mtp consumes the
    // mtp_pair_* prefix per CLAUDE.md "wire-format compat" rule;
    // generating an aegis_* prefix here would silently break
    // deployed MTPs that scan their config for mtp_pair_*.
    if (data.key_type === 'aegis-mtp-pairing') {
      const pairing = await issuePairing({
        organizationId: orgId,
        displayName: data.name,
        createdByUserId: userId,
        scopes: data.scopes,
      })
      const row = await queryOne(
        `SELECT id, name, key_prefix, permissions, scopes, rate_limit,
                expires_at, ai_context_level, key_type, key_owner_user_id,
                pairing_window_expires_at, paired_at,
                created_at
           FROM api_keys WHERE id = $1`,
        [pairing.id],
      )
      return NextResponse.json(
        {
          ...row,
          api_key: pairing.fullKey,
          granted: data.scopes,
          dropped: [],
          pairing_window_expires_at: pairing.pairingWindowExpiresAt,
          message:
            'Save this key NOW — it cannot be retrieved later. Hand it ' +
            'to your MTP to plug in. The MTP must complete the first ' +
            'handshake before the pairing window closes (15 minutes).',
        },
        { status: 201 },
      )
    }

    // Both other admin-issuable types are org-owned (no
    // key_owner_user_id). Scope ceiling doesn't apply — admin is
    // acting as the org and can grant any canonical scope to an
    // integration.
    const grantedScopes: ApiScope[] = data.scopes

    const { fullKey, prefix, hash } = generateApiKey()
    const expiresAt = new Date(
      Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000,
    )

    const row = await queryOne(
      `INSERT INTO api_keys
         (organization_id, name, key_hash, key_prefix,
          permissions, scopes,
          rate_limit, expires_at, ai_context_level,
          key_type, key_owner_user_id, created_by)
       VALUES ($1, $2, $3, $4,
               $5::jsonb, $6::text[],
               $7, $8, $9,
               $10, $11, $12)
       RETURNING id, name, key_prefix, permissions, scopes, rate_limit,
                 expires_at, ai_context_level, key_type, key_owner_user_id,
                 created_at`,
      [
        orgId,
        data.name,
        hash,
        prefix,
        JSON.stringify(grantedScopes),
        grantedScopes,
        data.rate_limit,
        expiresAt.toISOString(),
        data.ai_context_level,
        data.key_type,
        null, // key_owner_user_id — always NULL for admin-issued org-owned keys
        userId,
      ],
    )

    return NextResponse.json(
      {
        ...row,
        api_key: fullKey,
        granted: grantedScopes,
        dropped: [],
        message: 'Store this key securely. It will not be shown again.',
      },
      { status: 201 },
    )
  } catch (error) {
    if (isNoOrgError(error)) return noOrgResponse()
    console.error('Failed to create API key:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}

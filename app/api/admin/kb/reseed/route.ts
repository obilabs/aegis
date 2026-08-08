/**
 * POST /api/admin/kb/reseed
 *
 * Re-runs the KB seed functions for the current organization. Because
 * every seed function uses ON CONFLICT (organization_id, slug) DO
 * NOTHING, this ONLY inserts articles / policies / procedures /
 * training that don't already exist. Existing rows are untouched.
 *
 * Use this when we ship new seed content (e.g., new articles added to
 * lib/seed-articles.ts) and want to backfill it to existing installs
 * without waiting for a fresh org setup.
 *
 * Auth: admin-only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'
import { seedSystemArticles } from '@/lib/seed-articles'
import { seedPolicyArticles } from '@/lib/seed-policies'
import { seedProcedureArticles } from '@/lib/seed-procedures'
import { seedTrainingArticles } from '@/lib/seed-training'
import { logAudit, getClientIp } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { session, orgId, userId } = ctx
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const results: Record<string, string> = {}

  try {
    await seedSystemArticles(orgId)
    results.articles = 'ok'
  } catch (err) {
    results.articles = err instanceof Error ? err.message : 'failed'
  }

  try {
    await seedPolicyArticles(orgId)
    results.policies = 'ok'
  } catch (err) {
    results.policies = err instanceof Error ? err.message : 'failed'
  }

  try {
    await seedProcedureArticles(orgId)
    results.procedures = 'ok'
  } catch (err) {
    results.procedures = err instanceof Error ? err.message : 'failed'
  }

  try {
    await seedTrainingArticles(orgId)
    results.training = 'ok'
  } catch (err) {
    results.training = err instanceof Error ? err.message : 'failed'
  }

  logAudit({
    orgId,
    userId,
    action: 'kb_reseed',
    actionCategory: 'settings',
    entityType: 'kb',
    entityName: 'system_articles',
    newValues: results,
    actorIp: getClientIp(request.headers),
  })

  return NextResponse.json({ ok: true, results })
}

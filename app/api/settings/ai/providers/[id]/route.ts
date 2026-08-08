import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { logAudit, getClientIp } from '@/lib/audit'

// PATCH - Update an AI provider (including embedding configuration)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { session, userId, orgId } = ctx

  // Authorization (audit C2): editing AI providers is admin-only.
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    // Verify provider belongs to this organization
    const existing = await query<{ embedding_model: string | null }>(
      'SELECT id, embedding_model FROM ai_providers WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    const oldEmbeddingModel = existing[0].embedding_model

    // Build dynamic update
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const allowedFields = [
      'name', 'api_url', 'api_key_encrypted', 'is_active', 'is_default',
      'embedding_model', 'embedding_dimension', 'embedding_api_url',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`)
        values.push(body[field])
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, orgId)

    await query(
      `UPDATE ai_providers SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}`,
      values
    )

    logAudit({
      orgId, userId, action: 'ai_provider_updated', actionCategory: 'settings',
      entityType: 'ai_providers', entityId: id,
      newValues: Object.fromEntries(
        Object.entries(body).filter(([k]) => k !== 'api_key_encrypted')
      ),
      actorIp: getClientIp(request.headers),
    })

    // If embedding model changed and is now set, trigger bulk embedding
    const newEmbeddingModel = body.embedding_model
    if (newEmbeddingModel && newEmbeddingModel !== oldEmbeddingModel) {
      try {
        const { queueBulkEmbedding } = await import('@/lib/queue')
        const result = await queueBulkEmbedding(orgId)
        return NextResponse.json({
          success: true,
          embeddingJobsQueued: result.queued,
        })
      } catch (err) {
        console.error('[AI Settings] Failed to queue bulk embedding:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating AI provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update provider' },
      { status: 500 }
    )
  }
}

// DELETE - Remove an AI provider
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  // Authorization (audit C2): deleting AI providers is admin-only.
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { id } = await params

    // Verify provider belongs to this organization
    const existing = await query(
      'SELECT id FROM ai_providers WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Delete provider (ai_models cascade automatically via FK)
    await query('DELETE FROM ai_providers WHERE id = $1 AND organization_id = $2', [id, orgId])

    logAudit({
      orgId, userId, action: 'ai_provider_deleted', actionCategory: 'delete',
      entityType: 'ai_providers', entityId: id,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting AI provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete provider' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { uploadFile, buildPublicKey, validatePublicUpload } from '@/lib/storage'

// Public media assets — images that can be embedded via direct URL
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const assets = await query(
      `SELECT pa.id, pa.file_name, pa.file_type, pa.file_size, pa.alt_text, pa.storage_key, pa.created_at,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) AS uploaded_by_name
       FROM public_assets pa
       LEFT JOIN users u ON pa.uploaded_by = u.id
       WHERE pa.organization_id = $1
       ORDER BY pa.created_at DESC`,
      [orgId]
    )

    const assetsWithUrls = assets.map((a: any) => ({
      ...a,
      url: `/api/files/public/${a.storage_key}`,
    }))

    return NextResponse.json({ assets: assetsWithUrls })
  } catch (error) {
    console.error('Failed to fetch public assets:', error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const altText = formData.get('altText') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validation = validatePublicUpload(file.size, file.type)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const storageKey = buildPublicKey(orgId, file.name)

    await uploadFile(storageKey, buffer, file.type)

    const userId = await getUserId(session.user.email)
    const result = await query(
      `INSERT INTO public_assets (organization_id, file_name, file_type, file_size, storage_key, alt_text, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, file_name, file_type, file_size, alt_text, storage_key, created_at`,
      [orgId, file.name, file.type, file.size, storageKey, altText || null, userId]
    )

    const asset = result[0]
    return NextResponse.json({
      asset: { ...asset, url: `/api/files/public/${asset.storage_key}` },
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to upload public asset:', error)
    return NextResponse.json({ error: 'Failed to upload asset' }, { status: 500 })
  }
}

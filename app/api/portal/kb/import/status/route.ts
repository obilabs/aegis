import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { isDoclingAvailable, getSupportedFormats } from '@/lib/docling'

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const available = await isDoclingAvailable()

  if (available) {
    return NextResponse.json({
      available: true,
      formats: getSupportedFormats(),
    })
  }

  return NextResponse.json({
    available: false,
    reason: 'Document processing service is not configured',
  })
}

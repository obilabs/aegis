import { NextRequest, NextResponse } from 'next/server'
import { downloadFile } from '@/lib/storage'

// Public file serving — no auth required
// Only serves files under the public/ prefix in MinIO
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params
  const storageKey = key.join('/')

  // Only serve files from the public/ prefix
  if (!storageKey.startsWith('public/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { body, contentType, contentLength } = await downloadFile(storageKey)

    return new NextResponse(body as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(contentLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Failed to serve public file:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

import { getOpenApiSpec } from '@/lib/openapi/spec'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const spec = getOpenApiSpec()
    return NextResponse.json(spec, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('OpenAPI spec generation failed:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to generate OpenAPI spec', details: message },
      { status: 500 }
    )
  }
}

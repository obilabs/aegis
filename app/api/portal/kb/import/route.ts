import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { isDoclingAvailable, validateFile, extractDocument, splitIntoSections } from '@/lib/docling'
import { queueEmbeddingJob } from '@/lib/queue'
import { estimateTokens } from '@/lib/chunking'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  // Authorization (audit 2026-07-23): importing into the KB is content
  // management — same capability as authoring (canEditArticle -> 'settings').
  if (!(await hasCapabilityOrAdmin(userId, 'settings'))) {
    return NextResponse.json({ error: 'Requires settings capability' }, { status: 403 })
  }

  // Check if Docling is available
  const available = await isDoclingAvailable()
  if (!available) {
    return NextResponse.json(
      { success: false, error: 'Document processing service is not available. Please contact your administrator.' },
      { status: 503 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateFile(file.name, file.size)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // Extract text from document via Docling
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const extracted = await extractDocument(fileBuffer, file.name)

    if (!extracted.plainText.trim()) {
      return NextResponse.json(
        { success: false, error: 'No text could be extracted from the document' },
        { status: 400 }
      )
    }

    // Find or create an import category
    const categoryName = 'Imported Documents'
    let categoryResult = await query<{ id: string }>(
      `SELECT id FROM kb_categories
       WHERE organization_id = $1 AND name = $2
       LIMIT 1`,
      [orgId, categoryName]
    )

    let categoryId: string
    if (categoryResult.length > 0) {
      categoryId = categoryResult[0].id
    } else {
      const newCat = await query<{ id: string }>(
        `INSERT INTO kb_categories (organization_id, name, slug, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [orgId, categoryName, 'imported-documents', 'Articles imported from uploaded documents']
      )
      categoryId = newCat[0].id
    }

    // Determine if we need to split into multiple articles
    const totalTokens = estimateTokens(extracted.plainText)
    const articles: { id: string; title: string; slug: string }[] = []

    if (totalTokens > 10000) {
      // Split into sections
      const sections = splitIntoSections(extracted.markdown)

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        const sectionTitle = section.title || `${extracted.metadata.title} - Part ${i + 1}`
        const slug = slugify(sectionTitle)

        const result = await query<{ id: string }>(
          `INSERT INTO kb_articles
           (organization_id, title, slug, summary, content, content_plain,
            category_id, author_id, status, visibility)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'internal')
           RETURNING id`,
          [
            orgId,
            sectionTitle,
            slug + '-' + Date.now(),
            `Imported from ${file.name}${section.title ? ` - Section: ${section.title}` : ''}`,
            section.markdown,
            section.plainText,
            categoryId,
            userId,
          ]
        )

        articles.push({ id: result[0].id, title: sectionTitle, slug })

        // Queue embedding
        await queueEmbeddingJob('kb_articles', result[0].id, orgId)
      }
    } else {
      // Single article
      const title = extracted.metadata.title || file.name.replace(/\.[^.]+$/, '')
      const slug = slugify(title)

      const result = await query<{ id: string }>(
        `INSERT INTO kb_articles
         (organization_id, title, slug, summary, content, content_plain,
          category_id, author_id, status, visibility)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'internal')
         RETURNING id`,
        [
          orgId,
          title,
          slug + '-' + Date.now(),
          `Imported from ${file.name}`,
          extracted.markdown,
          extracted.plainText,
          categoryId,
          userId,
        ]
      )

      articles.push({ id: result[0].id, title, slug })

      // Queue embedding
      await queueEmbeddingJob('kb_articles', result[0].id, orgId)
    }

    return NextResponse.json({
      success: true,
      articles,
      source: file.name,
      totalSections: articles.length,
    })
  } catch (error: any) {
    console.error('[KB Import] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process document' },
      { status: 500 }
    )
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}

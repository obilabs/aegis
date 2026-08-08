/**
 * Docling Integration
 *
 * Communicates with the Docling sidecar service for document extraction.
 * Converts PDF, DOCX, PPTX, and other formats into text for KB articles.
 */

const DOCLING_URL = process.env.DOCLING_URL || 'http://docling:5001'

const SUPPORTED_FORMATS = ['pdf', 'docx', 'pptx', 'xlsx', 'html', 'png', 'jpg', 'jpeg']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export interface DoclingResult {
  markdown: string
  plainText: string
  metadata: {
    title?: string
    pageCount?: number
    format?: string
  }
}

/**
 * Check if the Docling service is reachable.
 */
export async function isDoclingAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${DOCLING_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get supported file formats.
 */
export function getSupportedFormats(): string[] {
  return SUPPORTED_FORMATS
}

/**
 * Validate a file for document extraction.
 */
export function validateFile(
  filename: string,
  size: number
): { valid: boolean; error?: string } {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext || !SUPPORTED_FORMATS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type. Supported: ${SUPPORTED_FORMATS.join(', ').toUpperCase()}`,
    }
  }
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    }
  }
  return { valid: true }
}

/**
 * Extract text from a document using the Docling service.
 * Sends the file as multipart/form-data to Docling's conversion endpoint.
 */
export async function extractDocument(
  fileBuffer: Buffer,
  filename: string
): Promise<DoclingResult> {
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(fileBuffer)])
  formData.append('files', blob, filename)

  // Request markdown output from Docling
  const response = await fetch(`${DOCLING_URL}/v1alpha/convert/file`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120000), // 2 min timeout for large documents
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Docling extraction failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  // Docling returns { document: { md_content, ... } } or similar
  // Handle different response formats
  const markdown = data.document?.md_content
    || data.md_content
    || data.content
    || data.text
    || ''

  // Strip markdown formatting for plain text
  const plainText = markdownToPlainText(markdown)

  // Extract title from first heading or filename
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1] || filename.replace(/\.[^.]+$/, '')

  return {
    markdown,
    plainText,
    metadata: {
      title,
      pageCount: data.document?.page_count || data.num_pages,
      format: filename.split('.').pop()?.toLowerCase(),
    },
  }
}

/**
 * Split extracted text into logical sections for separate KB articles.
 * Uses H1/H2 headings as section boundaries. Falls back to token-based splitting.
 */
export function splitIntoSections(
  markdown: string,
  maxTokensPerSection: number = 5000
): { title: string; markdown: string; plainText: string }[] {
  // Try splitting by H1/H2 headings
  const headingPattern = /^#{1,2}\s+(.+)$/gm
  const sections: { title: string; start: number; end?: number }[] = []

  let match
  while ((match = headingPattern.exec(markdown)) !== null) {
    if (sections.length > 0) {
      sections[sections.length - 1].end = match.index
    }
    sections.push({ title: match[1], start: match.index })
  }

  // Close last section
  if (sections.length > 0) {
    sections[sections.length - 1].end = markdown.length
  }

  // If no headings found or only one section, fall back to token-based splitting
  if (sections.length <= 1) {
    return splitByTokens(markdown, maxTokensPerSection)
  }

  return sections.map(s => {
    const sectionMarkdown = markdown.slice(s.start, s.end).trim()
    return {
      title: s.title,
      markdown: sectionMarkdown,
      plainText: markdownToPlainText(sectionMarkdown),
    }
  })
}

/**
 * Split text by approximate token count.
 */
function splitByTokens(
  markdown: string,
  maxTokens: number
): { title: string; markdown: string; plainText: string }[] {
  const approxChars = maxTokens * 4
  const totalLength = markdown.length

  if (totalLength <= approxChars) {
    return [{
      title: '',
      markdown,
      plainText: markdownToPlainText(markdown),
    }]
  }

  const parts: { title: string; markdown: string; plainText: string }[] = []
  let position = 0
  let partNumber = 1

  while (position < totalLength) {
    let end = Math.min(position + approxChars, totalLength)

    // Try to break at a paragraph boundary
    if (end < totalLength) {
      const breakPoint = markdown.lastIndexOf('\n\n', end)
      if (breakPoint > position + approxChars * 0.5) {
        end = breakPoint
      }
    }

    const partMarkdown = markdown.slice(position, end).trim()
    parts.push({
      title: `Part ${partNumber}`,
      markdown: partMarkdown,
      plainText: markdownToPlainText(partMarkdown),
    })

    position = end
    partNumber++
  }

  return parts
}

/**
 * Strip markdown formatting to produce plain text.
 */
function markdownToPlainText(markdown: string): string {
  return markdown
    // Remove headings (# ## ### etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

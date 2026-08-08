/**
 * Text chunking module for embedding generation.
 *
 * Splits long text into overlapping chunks suitable for embedding models
 * with limited context windows (~512 tokens).
 */

/**
 * Approximate token count using the ~4 chars/token heuristic.
 * Good enough for chunking — exact tokenization isn't needed here.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface TextChunk {
  text: string
  index: number
  tokenCount: number
}

/**
 * Split text into chunks of approximately `maxTokens` tokens with `overlapTokens` overlap.
 *
 * Strategy:
 * 1. Split on paragraph boundaries (\n\n) first
 * 2. If a paragraph exceeds maxTokens, split on sentence boundaries
 * 3. Reassemble into chunks that fit within the token budget
 * 4. Add overlap from the end of the previous chunk
 *
 * Returns empty array if text fits within a single chunk.
 */
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlapTokens: number = 50
): TextChunk[] {
  const totalTokens = estimateTokens(text)

  // No chunking needed for short text
  if (totalTokens <= maxTokens) {
    return []
  }

  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  const chunks: TextChunk[] = []
  let currentChunkParts: string[] = []
  let currentTokens = 0

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokens(paragraph)

    // If a single paragraph exceeds max, split it by sentences
    if (paraTokens > maxTokens) {
      // Flush current chunk first
      if (currentChunkParts.length > 0) {
        const chunkText = currentChunkParts.join('\n\n')
        chunks.push({
          text: chunkText,
          index: chunks.length,
          tokenCount: estimateTokens(chunkText),
        })
        currentChunkParts = []
        currentTokens = 0
      }

      // Split long paragraph by sentences
      const sentences = splitSentences(paragraph)
      let sentenceParts: string[] = []
      let sentenceTokens = 0

      for (const sentence of sentences) {
        const sTokens = estimateTokens(sentence)

        if (sentenceTokens + sTokens > maxTokens && sentenceParts.length > 0) {
          const chunkText = sentenceParts.join(' ')
          chunks.push({
            text: chunkText,
            index: chunks.length,
            tokenCount: estimateTokens(chunkText),
          })
          // Keep overlap from the end
          const overlapText = getOverlapText(sentenceParts, overlapTokens)
          sentenceParts = overlapText ? [overlapText] : []
          sentenceTokens = overlapText ? estimateTokens(overlapText) : 0
        }

        sentenceParts.push(sentence)
        sentenceTokens += sTokens
      }

      // Flush remaining sentences
      if (sentenceParts.length > 0) {
        const chunkText = sentenceParts.join(' ')
        currentChunkParts = [chunkText]
        currentTokens = estimateTokens(chunkText)
      }

      continue
    }

    // Would adding this paragraph exceed the limit?
    if (currentTokens + paraTokens > maxTokens && currentChunkParts.length > 0) {
      const chunkText = currentChunkParts.join('\n\n')
      chunks.push({
        text: chunkText,
        index: chunks.length,
        tokenCount: estimateTokens(chunkText),
      })

      // Start new chunk with overlap from end of previous
      const overlapText = getOverlapText(currentChunkParts, overlapTokens)
      currentChunkParts = overlapText ? [overlapText, paragraph] : [paragraph]
      currentTokens = (overlapText ? estimateTokens(overlapText) : 0) + paraTokens
    } else {
      currentChunkParts.push(paragraph)
      currentTokens += paraTokens
    }
  }

  // Flush final chunk
  if (currentChunkParts.length > 0) {
    const chunkText = currentChunkParts.join('\n\n')
    chunks.push({
      text: chunkText,
      index: chunks.length,
      tokenCount: estimateTokens(chunkText),
    })
  }

  // Re-index
  return chunks.map((c, i) => ({ ...c, index: i }))
}

/**
 * Split text into sentences (approximate).
 */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or end
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim())
}

/**
 * Get overlap text from the end of parts, up to `overlapTokens` tokens.
 */
function getOverlapText(parts: string[], overlapTokens: number): string | null {
  if (parts.length === 0 || overlapTokens <= 0) return null

  const lastPart = parts[parts.length - 1]
  const words = lastPart.split(/\s+/)
  const overlapChars = overlapTokens * 4

  let overlap = ''
  for (let i = words.length - 1; i >= 0; i--) {
    const candidate = words.slice(i).join(' ')
    if (candidate.length > overlapChars) break
    overlap = candidate
  }

  return overlap || null
}

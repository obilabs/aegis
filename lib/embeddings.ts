/**
 * Embedding generation module
 *
 * Generates vector embeddings via the configured AI provider (Ollama or OpenAI-compatible).
 * Returns null when no embedding model is configured — callers should handle gracefully.
 */

import { queryOne } from './db'

interface EmbeddingProvider {
  id: string
  provider_type: string
  api_url: string
  api_key_encrypted: string | null
  embedding_model: string | null
  embedding_dimension: number | null
  embedding_api_url: string | null
}

/**
 * Get the active embedding provider for an organization.
 * Returns null if no provider has an embedding model configured.
 */
export async function getEmbeddingProvider(organizationId: string): Promise<EmbeddingProvider | null> {
  const provider = await queryOne<EmbeddingProvider>(
    `SELECT id, provider_type, api_url, api_key_encrypted,
            embedding_model, embedding_dimension, embedding_api_url
     FROM ai_providers
     WHERE organization_id = $1
       AND is_active = true
       AND embedding_model IS NOT NULL
     ORDER BY is_default DESC, created_at DESC
     LIMIT 1`,
    [organizationId]
  )
  return provider || null
}

/**
 * Generate a single embedding vector for the given text.
 * Returns null if no embedding model is configured for the provider.
 */
export async function generateEmbedding(
  text: string,
  organizationId: string
): Promise<number[] | null> {
  const provider = await getEmbeddingProvider(organizationId)
  if (!provider || !provider.embedding_model) return null

  const result = await callEmbeddingAPI(provider, text)
  return result
}

/**
 * Generate embeddings for multiple texts in a single batch.
 * Returns an array of vectors (or null for failed items).
 */
export async function generateEmbeddings(
  texts: string[],
  organizationId: string
): Promise<(number[] | null)[]> {
  const provider = await getEmbeddingProvider(organizationId)
  if (!provider || !provider.embedding_model) {
    return texts.map(() => null)
  }

  const results: (number[] | null)[] = []
  for (const text of texts) {
    try {
      const embedding = await callEmbeddingAPI(provider, text)
      results.push(embedding)
    } catch {
      results.push(null)
    }
  }
  return results
}

/**
 * Call the embedding API for the given provider.
 */
async function callEmbeddingAPI(
  provider: EmbeddingProvider,
  text: string
): Promise<number[] | null> {
  const trimmed = text.trim()
  if (!trimmed) return null

  switch (provider.provider_type) {
    case 'ollama':
      return callOllamaEmbedding(provider, trimmed)
    case 'openai':
      return callOpenAIEmbedding(provider, trimmed)
    case 'google':
      return callGoogleEmbedding(provider, trimmed)
    default:
      // Try OpenAI-compatible API as fallback
      return callOpenAIEmbedding(provider, trimmed)
  }
}

async function callOllamaEmbedding(
  provider: EmbeddingProvider,
  text: string
): Promise<number[] | null> {
  const url = provider.embedding_api_url || `${provider.api_url}/api/embed`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: provider.embedding_model,
      input: text,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Ollama embedding error (${response.status}):`, errorText)
    throw new Error(`Ollama embedding API error: ${response.status}`)
  }

  const data = await response.json()
  // Ollama returns { embeddings: [[...]] } for /api/embed
  const embedding = data.embeddings?.[0] || data.embedding
  if (!Array.isArray(embedding)) {
    throw new Error('Unexpected Ollama embedding response format')
  }
  return embedding
}

async function callOpenAIEmbedding(
  provider: EmbeddingProvider,
  text: string
): Promise<number[] | null> {
  const url = provider.embedding_api_url || `${provider.api_url}/embeddings`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.api_key_encrypted || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.embedding_model,
      input: text,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`OpenAI embedding error (${response.status}):`, errorText)
    throw new Error(`OpenAI embedding API error: ${response.status}`)
  }

  const data = await response.json()
  const embedding = data.data?.[0]?.embedding
  if (!Array.isArray(embedding)) {
    throw new Error('Unexpected OpenAI embedding response format')
  }
  return embedding
}

async function callGoogleEmbedding(
  provider: EmbeddingProvider,
  text: string
): Promise<number[] | null> {
  const apiKey = provider.api_key_encrypted || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return null

  const model = provider.embedding_model || 'text-embedding-004'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Google embedding error (${response.status}):`, errorText)
    throw new Error(`Google embedding API error: ${response.status}`)
  }

  const data = await response.json()
  const embedding = data.embedding?.values
  if (!Array.isArray(embedding)) {
    throw new Error('Unexpected Google embedding response format')
  }
  return embedding
}

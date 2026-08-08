import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'

interface AIProvider {
  id: string
  provider_type: string
  api_url: string
  api_key_encrypted: string | null
  is_local: boolean
}

interface AIModel {
  model_name: string
  temperature: number
  max_tokens: number
}

const ARTICLE_GENERATION_PROMPT = `You are a technical writer for an IT support team. Generate a professional knowledge base article based on the topic provided.

Output format (use markdown):
- Start with a clear, concise title (do NOT include "# " prefix)
- Write a 1-2 sentence summary
- Write the article content with:
  - Problem description or overview
  - Step-by-step solution or guide
  - Common variations or edge cases
  - When to escalate (if applicable)
- Use clear headings, numbered steps for procedures, and bullet points for lists
- Keep language professional but accessible
- Do not use emojis

Return your response as JSON with this exact structure:
{"title": "...", "summary": "...", "content": "...", "tags": ["tag1", "tag2"]}

IMPORTANT: Return ONLY the JSON object, no markdown code fences, no extra text.`

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Authorization (audit 2026-07-23): AI-generating a KB article is content
  // management — same capability as authoring (canEditArticle -> 'settings').
  const ctx = await getAuthContext(request)
  if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'settings'))) {
    return NextResponse.json({ error: 'Requires settings capability' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { topic, category, context } = body

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    // Use the caller's own organization (single-tenant). Never invent a
    // "Default Organization" — a second org poisons getOrgId() identity
    // resolution for the whole instance (audit 2026-07-26).
    const orgId = ctx.orgId

    // Get active AI provider
    const providers = await query<AIProvider>(
      `SELECT id, provider_type, api_url, api_key_encrypted, is_local
       FROM ai_providers
       WHERE organization_id = $1 AND is_active = true
       ORDER BY is_default DESC, created_at DESC
       LIMIT 1`,
      [orgId]
    )

    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
    let providerType = 'google'
    let apiUrl = ''
    let modelName = 'gemini-2.0-flash'

    if (providers.length > 0) {
      const provider = providers[0]
      providerType = provider.provider_type
      apiUrl = provider.api_url
      apiKey = provider.api_key_encrypted || apiKey || ''

      const models = await query<AIModel>(
        `SELECT model_name, temperature, max_tokens
         FROM ai_models
         WHERE provider_id = $1 AND is_active = true
         ORDER BY is_default DESC LIMIT 1`,
        [provider.id]
      )
      if (models.length > 0) {
        modelName = models[0].model_name
      } else {
        modelName = provider.is_local ? 'llama3.2' : 'gpt-3.5-turbo'
      }
    } else if (!apiKey) {
      return NextResponse.json(
        { error: 'No AI provider configured. Go to Settings > AI to add one.' },
        { status: 400 }
      )
    }

    const userPrompt = `Generate a KB article about: ${topic}${category ? `\nCategory: ${category}` : ''}${context ? `\nAdditional context: ${context}` : ''}`

    let generatedText = ''

    if (providerType === 'google') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: ARTICLE_GENERATION_PROMPT }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
          }),
        }
      )
      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)
      const data = await response.json()
      generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } else if (providerType === 'ollama') {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: ARTICLE_GENERATION_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          options: { temperature: 0.7 },
        }),
      })
      if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
      const data = await response.json()
      generatedText = data.message?.content || ''
    } else {
      // OpenAI-compatible
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: ARTICLE_GENERATION_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      })
      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
      const data = await response.json()
      generatedText = data.choices?.[0]?.message?.content || ''
    }

    // Parse the generated JSON
    let article
    try {
      // Strip markdown code fences if present
      const cleaned = generatedText.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim()
      article = JSON.parse(cleaned)
    } catch {
      // If JSON parsing fails, use the raw text as content
      article = {
        title: topic,
        summary: '',
        content: generatedText,
        tags: [],
      }
    }

    // Generate slug from title
    const slug = (article.title || topic)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100)

    return NextResponse.json({
      article: {
        title: article.title || topic,
        slug,
        summary: article.summary || '',
        content: article.content || generatedText,
        tags: article.tags || [],
        category: category || '',
      },
    })
  } catch (error) {
    console.error('Article generation failed:', error)
    return NextResponse.json({ error: 'Failed to generate article' }, { status: 500 })
  }
}

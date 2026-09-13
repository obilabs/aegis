import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'

interface AIProcessRequest {
  action: string
  text: string
  prompt: string
  context?: string
}

interface AIProvider {
  id: string
  name: string
  api_url: string
  api_key: string | null
  is_local: boolean
}

interface AIModel {
  id: string
  model_name: string
  system_prompt: string | null
  temperature: number
  max_tokens: number
}

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body: AIProcessRequest = await request.json()
    const { action, text, prompt, context } = body

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: 'No text provided' },
        { status: 400 }
      )
    }

    const orgId = await getOrgId()

    // Check if AI editor feature is enabled
    const featureCheck = await query<{ enabled: boolean }>(
      `SELECT enabled FROM organization_feature_flags
       WHERE organization_id = $1 AND feature_key = 'ai_editor'`,
      [orgId]
    )
    if (featureCheck.length === 0 || !featureCheck[0].enabled) {
      return NextResponse.json(
        { success: false, error: 'AI Editor is not enabled. Enable it in Settings > Features.' },
        { status: 403 }
      )
    }

    // Get the active AI provider and model for this organization
    const providerResult = await query<AIProvider>(
      `SELECT p.id, p.name, p.api_url, p.api_key, p.is_local
       FROM ai_providers p
       WHERE p.organization_id = $1 AND p.is_active = true
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [orgId]
    )

    if (providerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No AI provider configured. Go to Settings → AI to add one.' },
        { status: 400 }
      )
    }

    const provider = providerResult[0]

    // Get the default model for this provider
    const modelResult = await query<AIModel>(
      `SELECT id, model_name, system_prompt, temperature, max_tokens
       FROM ai_models
       WHERE provider_id = $1 AND is_active = true AND (use_case = 'general' OR is_default = true)
       ORDER BY is_default DESC
       LIMIT 1`,
      [provider.id]
    )

    const model = modelResult[0] || {
      model_name: provider.is_local ? 'llama2' : 'gpt-3.5-turbo',
      system_prompt: null,
      temperature: 0.7,
      max_tokens: 2000,
    }

    // Build the full prompt
    const systemPrompt = model.system_prompt || 
      'You are a helpful IT documentation assistant. Respond with clean, well-formatted text. Do not include markdown code fences in your response.'
    
    const fullPrompt = context 
      ? `${prompt}\n\nContext: ${context}\n\nText to process:\n${text}`
      : `${prompt}\n\n${text}`

    // Call the AI provider
    if (provider.is_local) {
      // Ollama-style API
      return await processWithOllama(provider.api_url, model.model_name, systemPrompt, fullPrompt, model.temperature)
    } else {
      // OpenAI-compatible API
      return await processWithOpenAI(provider.api_url, provider.api_key!, model.model_name, systemPrompt, fullPrompt, model.temperature, model.max_tokens)
    }

  } catch (error) {
    console.error('AI processing error:', error)
    return NextResponse.json(
      { success: false, error: 'AI processing failed' },
      { status: 500 }
    )
  }
}

async function processWithGemini(text: string, prompt: string, context?: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'No AI provider configured' },
      { status: 400 }
    )
  }

  const fullPrompt = context 
    ? `${prompt}\n\nContext: ${context}\n\nText to process:\n${text}`
    : `${prompt}\n\n${text}`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          }
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Gemini API request failed')
    }

    const data = await response.json()
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return NextResponse.json({
      success: true,
      result: cleanAIResponse(result),
    })
  } catch (error) {
    console.error('Gemini error:', error)
    return NextResponse.json(
      { success: false, error: 'AI processing failed' },
      { status: 500 }
    )
  }
}

async function processWithOllama(
  apiUrl: string, 
  model: string, 
  systemPrompt: string, 
  userPrompt: string,
  temperature: number
) {
  try {
    const response = await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature,
        }
      }),
    })

    if (!response.ok) {
      throw new Error('Ollama API request failed')
    }

    const data = await response.json()
    return NextResponse.json({
      success: true,
      result: cleanAIResponse(data.response || ''),
    })
  } catch (error) {
    console.error('Ollama error:', error)
    return NextResponse.json(
      { success: false, error: 'AI processing failed - is Ollama running?' },
      { status: 500 }
    )
  }
}

async function processWithOpenAI(
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
) {
  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      throw new Error('OpenAI API request failed')
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      result: cleanAIResponse(result),
    })
  } catch (error) {
    console.error('OpenAI error:', error)
    return NextResponse.json(
      { success: false, error: 'AI processing failed' },
      { status: 500 }
    )
  }
}

function cleanAIResponse(text: string): string {
  // Remove markdown code fences
  let cleaned = text.replace(/```html?\n?/gi, '').replace(/```\n?/g, '')
  
  // Remove leading "html" if present
  cleaned = cleaned.replace(/^html\s*/i, '')
  
  // Trim whitespace
  cleaned = cleaned.trim()
  
  return cleaned
}

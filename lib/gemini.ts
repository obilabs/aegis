import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

// Custom error class for Gemini API errors
export type GeminiErrorType = 'offline' | 'blocked' | 'error'

export class GeminiError extends Error {
  type: GeminiErrorType

  constructor(type: GeminiErrorType, message: string) {
    super(message)
    this.name = 'GeminiError'
    this.type = type
  }
}

export interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

/**
 * Send a chat message to Gemini and get a response
 * Uses gemini-2.0-flash for speed and cost efficiency
 */
export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  userMessage: string
): Promise<string> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new GeminiError('offline', 'AI chat is not configured. GOOGLE_AI_API_KEY environment variable is not set.')
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: systemPrompt,
    })

    // Convert our message format to Gemini's format
    const history = messages.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }))

    // Start a chat session with history
    const chatSession = model.startChat({
      history,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
      },
    })

    // Send the user's message and get response
    const result = await chatSession.sendMessage(userMessage)
    const response = result.response.text()

    return response
  } catch (error) {
    console.error('Gemini API error:', error)

    // Handle specific error types
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase()

      if (errorMessage.includes('api key') || errorMessage.includes('api_key_invalid')) {
        throw new GeminiError('offline', 'Invalid API key. Please check your GOOGLE_AI_API_KEY configuration.')
      }
      if (errorMessage.includes('quota') || errorMessage.includes('resource_exhausted') || errorMessage.includes('429')) {
        throw new GeminiError('offline', 'API quota exceeded. The support chat is temporarily unavailable.')
      }
      if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
        throw new GeminiError('blocked', 'This content was blocked for safety reasons. Please rephrase your question.')
      }
    }

    throw new GeminiError('error', 'Failed to get response from AI. Please try again.')
  }
}

/**
 * Simple one-shot completion without chat history
 * Useful for generating conversation titles
 */
export async function complete(prompt: string): Promise<string> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new GeminiError('offline', 'AI is not configured. GOOGLE_AI_API_KEY environment variable is not set.')
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch (error) {
    console.error('Gemini completion error:', error)
    throw new Error('Failed to generate content')
  }
}

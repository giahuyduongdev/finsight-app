import { GoogleGenAI } from '@google/genai'
import { Env } from './env.config'

// Parse API keys from comma-separated string
const apiKeys = Env.GEMINI_API_KEY.split(',')
  .map((key) => key.trim())
  .filter(Boolean)

// Model priority sequence
export const AI_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
]

/**
 * Get a pool of generative AI instances
 */
export const getAiPool = () => {
  if (apiKeys.length === 0) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables')
  }
  return apiKeys.map((key) => new GoogleGenAI({ apiKey: key }))
}

export const defaultModel = AI_MODELS[0]

import {
  GoogleGenAI,
  type ContentListUnion,
  type GenerateContentConfig,
  type GenerateContentResponse
} from '@google/genai'
import { Env } from './env.config'
import { logger } from './logger.config'

const apiKeys = Env.GEMINI_API_KEY.split(',')
  .map((key) => key.trim())
  .filter(Boolean)

if (apiKeys.length === 0) {
  throw new Error('GEMINI_API_KEY is not configured in environment variables')
}

// Model priority sequence — cập nhật 27/4/2026
// gemini-2.5-flash     → hết hạn 17/6/2026
// gemini-2.5-flash-lite → hết hạn 22/7/2026
// gemini-3-flash-preview → chưa có ngày hết hạn
export const AI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview'
] as const

export const defaultModel = AI_MODELS[0]

// fix bug indexOf khi key trùng → dùng index từ map
const aiPool = apiKeys.map((key, i) => ({
  instance: new GoogleGenAI({ apiKey: key }),
  keyIndex: i + 1
}))

const isRetryableError = (message: string): boolean => {
  return (
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('UNAVAILABLE') ||
    message.includes('DEADLINE_EXCEEDED') ||
    message.includes('403') ||
    message.includes('PERMISSION_DENIED') ||
    message.includes('404') ||
    message.includes('NOT_FOUND')
    // Removed INVALID_ARGUMENT - it's now in isFatalError
  )
}

const isFatalError = (message: string): boolean => {
  return (
    message.includes('SAFETY') ||
    message.includes('BLOCKED') ||
    message.includes('API_KEY_INVALID') ||
    message.includes('invalid api key') ||
    message.includes('INVALID_ARGUMENT') // INVALID_ARGUMENT is not retryable
  )
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const generateWithFallback = async (
  contents: ContentListUnion,
  config: GenerateContentConfig = {}
): Promise<GenerateContentResponse> => {
  let lastError: Error | null = null
  let attemptCount = 0 // Track total attempts for exponential backoff

  for (const modelName of AI_MODELS) {
    for (const { instance, keyIndex } of aiPool) {
      try {
        attemptCount++
        logger.info(`[APP:AI] Attempting: ${modelName} | Key ${keyIndex}`)

        const response = await instance.models.generateContent({
          model: modelName,
          contents,
          config: {
            ...config,
            httpOptions: { timeout: 30000, ...config.httpOptions }
          }
        })

        logger.info(`[APP:AI] Success: ${modelName} | Key ${keyIndex}`)
        return response
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const msg = lastError.message

        if (isFatalError(msg)) {
          logger.error(`[APP:AI] Fatal error on ${modelName}: ${msg}`)
          throw lastError
        }

        if (isRetryableError(msg)) {
          logger.warn(
            `[APP:AI] Retry: ${modelName} | Key ${keyIndex}: ${msg.slice(0, 80)}`
          )

          // Exponential backoff for rate limits (429)
          if (msg.includes('429')) {
            const baseDelay = 1000
            const maxDelay = 30000
            const backoffDelay = Math.min(
              baseDelay * Math.pow(2, attemptCount),
              maxDelay
            )
            const jitter = Math.random() * 1000 // Add jitter to avoid thundering herd
            await delay(backoffDelay + jitter)
          } else if (
            msg.includes('503') ||
            msg.includes('504') ||
            msg.includes('DEADLINE') ||
            msg.includes('UNAVAILABLE')
          ) {
            // Fixed delay for server errors
            await delay(2000)
          }
          continue
        }

        logger.error(`[APP:AI] Unknown error on ${modelName}: ${msg}`)
        throw lastError
      }
    }
  }

  logger.error('[APP:AI] All models and API keys exhausted')
  throw lastError ?? new Error('All AI models and API keys exhausted')
}

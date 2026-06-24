import { Env } from './env.config'

const parseBoolean = (value: string, fallback: boolean) => {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

const parsePositiveInteger = (value: string, fallback: number) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const receiptConfig = {
  queueIntakeEnabled: parseBoolean(Env.RECEIPT_QUEUE_INTAKE_ENABLED, true),
  workerEnabled: parseBoolean(Env.RECEIPT_WORKER_ENABLED, true),
  workerConcurrency: parsePositiveInteger(Env.RECEIPT_WORKER_CONCURRENCY, 2),
  maxAttempts: parsePositiveInteger(Env.RECEIPT_MAX_ATTEMPTS, 3),
  backoffDelayMs: parsePositiveInteger(Env.RECEIPT_BACKOFF_DELAY_MS, 10_000),
  aiRateLimitMax: parsePositiveInteger(Env.RECEIPT_AI_RATE_LIMIT_MAX, 10),
  aiRateLimitDurationMs: parsePositiveInteger(
    Env.RECEIPT_AI_RATE_LIMIT_DURATION_MS,
    60_000
  ),
  downloadTimeoutMs: parsePositiveInteger(
    Env.RECEIPT_DOWNLOAD_TIMEOUT_MS,
    10_000
  ),
  processingTimeoutMs: parsePositiveInteger(
    Env.RECEIPT_PROCESSING_TIMEOUT_MS,
    60_000
  ),
  maxDownloadBytes: parsePositiveInteger(
    Env.RECEIPT_MAX_DOWNLOAD_BYTES,
    5 * 1024 * 1024
  )
} as const

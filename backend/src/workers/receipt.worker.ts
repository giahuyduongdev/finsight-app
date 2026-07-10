import { Worker, Job, UnrecoverableError } from 'bullmq'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import { getIO } from '../config/socket.config'
import { invalidateUserAnalyticsCache } from '../utils/cache.util'
import { RECEIPT_JOBS, ScanReceiptJobData } from '../queues/receipt.queue'
import { redis } from '../config/redis.config'
import {
  CachedReceiptScanData,
  getReceiptCloudinaryPublicId,
  getReceiptScanCacheKey,
  getReceiptScanCacheTtlSeconds,
  parseCachedReceiptScan
} from '../utils/receipt/scan-cache.util'
import { uploadReceiptImageToCloudinary } from '../utils/receipt/upload.util'
import {
  extractReceiptDataFromBase64,
  NonReceiptImageError
} from '../utils/receipt/ai.util'
import { receiptConfig } from '../config/receipt.config'
import {
  classifyProviderError,
  observeBullMQJobProcessing,
  observeBullMQJobWait,
  observeProviderCall,
  recordBullMQJobOutcome,
  recordBullMQWorkerError,
  recordReceiptCache,
  recordReceiptScan
} from '../observability'
import { captureBackgroundError } from '../config/sentry.config'
import { createSystemNotification } from '../utils/notification.util'

const MAX_RETRY_DELAY_MS = 30000

export class ExpectedReceiptRejectionError extends UnrecoverableError {}

function getNextRetryDelay(job?: Job): number {
  const backoff = job?.opts.backoff
  const baseDelay =
    typeof backoff === 'object' &&
    backoff !== null &&
    'delay' in backoff &&
    typeof backoff.delay === 'number'
      ? backoff.delay
      : 1000
  const retryIndex = Math.max((job?.attemptsMade ?? 1) - 1, 0)

  return Math.min(baseDelay * 2 ** retryIndex, MAX_RETRY_DELAY_MS)
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Safely invalidate user analytics cache with error handling
 */
async function safeInvalidateUserAnalyticsCache(userId: string): Promise<void> {
  try {
    await invalidateUserAnalyticsCache(userId)
  } catch (cacheError) {
    const error = cacheError as Error
    logger.warn(`[JOB:Receipt] Cache invalidation failed for user ${userId}`, {
      error: error.message
    })
    // Continue - cache invalidation failure is non-critical
  }
}

async function cacheReceiptScan(
  userId: string,
  imageHash: string | undefined,
  data: CachedReceiptScanData
) {
  if (!imageHash) return

  const cacheKey = getReceiptScanCacheKey(userId, imageHash)

  try {
    await redis.set(
      cacheKey,
      JSON.stringify({
        data,
        cachedAt: new Date().toISOString()
      }),
      'EX',
      getReceiptScanCacheTtlSeconds()
    )
  } catch (error) {
    logger.warn('[JOB:Receipt] Receipt scan cache write failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

// ─── Job Processing ───────────────────────────────────────────────────────────

/**
 * Process receipt scanning job with async upload and cleanup
 */
export async function processScanReceiptJob(job: Job<ScanReceiptJobData>) {
  const { userId, fileBuffer, imageUrl, fileName, fileSize, correlationId } =
    job.data
  const { imageHash } = job.data
  const processingStartedAt = process.hrtime.bigint()
  const processingStartedAtMs = Date.now()
  const remainingProcessingMs = () =>
    Math.max(
      receiptConfig.processingTimeoutMs - (Date.now() - processingStartedAtMs),
      1
    )
  const queueWaitSeconds = job.data.enqueuedAt
    ? Math.max((Date.now() - new Date(job.data.enqueuedAt).getTime()) / 1000, 0)
    : 0

  observeBullMQJobWait('receipt', RECEIPT_JOBS.SCAN_RECEIPT, queueWaitSeconds)

  try {
    if (imageHash) {
      const cacheKey = getReceiptScanCacheKey(userId, imageHash)

      try {
        const rawCached = await redis.get(cacheKey)
        const cachedReceipt = parseCachedReceiptScan(rawCached)

        if (cachedReceipt) {
          recordReceiptCache('hit')
          recordReceiptScan('skipped')
          observeBullMQJobProcessing(
            'receipt',
            RECEIPT_JOBS.SCAN_RECEIPT,
            'skipped',
            Number(process.hrtime.bigint() - processingStartedAt) /
              1_000_000_000
          )
          getIO().to(userId).emit('receipt:scan-completed', {
            jobId: job.id,
            data: cachedReceipt.data
          })

          await createSystemNotification({
            userId,
            type: 'receipt_scan.completed',
            title: 'Receipt scan completed',
            description: 'Receipt scan data is ready to review',
            severity: 'success',
            actionUrl: '/transactions',
            metadata: {
              entityType: 'receipt',
              entityId: job.id
            },
            idempotencyKey: `receipt-scan:${job.id}:completed`
          })

          return {
            status: 'skipped',
            reason: 'receipt-scan-cache-hit',
            details: { imageHash }
          }
        }
        recordReceiptCache(rawCached ? 'corrupt' : 'miss')
      } catch (cacheError) {
        recordReceiptCache('corrupt')
        logger.warn('[JOB:Receipt] Receipt scan cache read failed', {
          error:
            cacheError instanceof Error
              ? cacheError.message
              : String(cacheError)
        })
      }
    }

    let finalImageUrl: string
    let base64ForAI: string

    // Check if we have base64 (first run) or URL (after cleanup/retry)
    if (fileBuffer) {
      // First run: We have base64
      const imageBuffer = Buffer.from(fileBuffer, 'base64')
      base64ForAI = fileBuffer

      // [OPTIMIZED] Upload to Cloudinary and process AI in parallel
      const [uploadResult, geminiResult] = await Promise.allSettled([
        uploadReceiptImageToCloudinary(imageBuffer, {
          publicId: imageHash
            ? getReceiptCloudinaryPublicId(userId, imageHash)
            : undefined
        }), // ~600ms
        extractReceiptDataFromBase64(base64ForAI, {
          maxElapsedMs: remainingProcessingMs()
        }) // ~2000ms (bottleneck)
      ])

      // Persist upload result first, even if Gemini fails
      if (uploadResult.status === 'fulfilled') {
        finalImageUrl = uploadResult.value.secure_url

        // [CLEANUP] Update job data: Replace base64 with URL to free Redis memory
        await job.updateData({
          userId,
          imageHash,
          imageUrl: uploadResult.value.secure_url,
          fileBuffer: undefined, // Clear base64 from Redis
          fileName,
          fileSize,
          correlationId
        })
      } else {
        throw new Error(
          `Cloudinary upload failed: ${uploadResult.reason?.message || 'Unknown error'}`
        )
      }

      // Now validate Gemini response
      if (geminiResult.status === 'rejected') {
        if (geminiResult.reason instanceof NonReceiptImageError) {
          throw geminiResult.reason
        }

        throw new Error(
          `Gemini extraction failed: ${geminiResult.reason?.message || 'Unknown error'}`
        )
      }

      const data = geminiResult.value
      const receiptData = {
        ...data,
        receiptUrl: finalImageUrl
      }

      await cacheReceiptScan(userId, imageHash, receiptData)
      recordReceiptScan('succeeded')

      // Emit success event
      const io = getIO()
      io.to(userId).emit('receipt:scan-completed', {
        jobId: job.id,
        data: receiptData
      })

      await createSystemNotification({
        userId,
        type: 'receipt_scan.completed',
        title: 'Receipt scan completed',
        description: 'Receipt scan data is ready to review',
        severity: 'success',
        actionUrl: '/transactions',
        metadata: {
          entityType: 'receipt',
          entityId: job.id
        },
        idempotencyKey: `receipt-scan:${job.id}:completed`
      })

      // Invalidate analytics cache
      await safeInvalidateUserAnalyticsCache(userId)

      observeBullMQJobProcessing(
        'receipt',
        RECEIPT_JOBS.SCAN_RECEIPT,
        'completed',
        Number(process.hrtime.bigint() - processingStartedAt) / 1_000_000_000
      )
      return {
        status: 'succeeded' as const,
        details: { imageHash }
      }
    } else if (imageUrl) {
      // Retry case: Upload succeeded but AI extraction failed
      // Download image from Cloudinary and retry AI extraction
      logger.info(
        '[JOB:Receipt] Processing receipt image from durable object storage',
        {
          jobId: job.id,
          correlationId,
          hasImageUrl: true
        }
      )

      // Fetch image from Cloudinary with timeout
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        receiptConfig.downloadTimeoutMs
      )

      try {
        base64ForAI = await observeProviderCall(
          {
            provider: 'cloudinary',
            operation: 'receipt_download'
          },
          async () => {
            const response = await fetch(imageUrl, {
              signal: controller.signal
            })
            if (!response.ok) {
              throw new Error(
                `Failed to fetch image from Cloudinary: ${response.status}`
              )
            }

            const contentLength = Number(response.headers.get('content-length'))
            if (
              Number.isFinite(contentLength) &&
              contentLength > receiptConfig.maxDownloadBytes
            ) {
              throw new UnrecoverableError(
                'Receipt image exceeds download limit'
              )
            }

            const arrayBuffer = await response.arrayBuffer()
            if (arrayBuffer.byteLength > receiptConfig.maxDownloadBytes) {
              throw new UnrecoverableError(
                'Receipt image exceeds download limit'
              )
            }
            return Buffer.from(arrayBuffer).toString('base64')
          }
        )
      } finally {
        clearTimeout(timeout)
      }

      // Retry AI extraction
      const data = await extractReceiptDataFromBase64(base64ForAI, {
        maxElapsedMs: remainingProcessingMs()
      })
      const receiptData = {
        ...data,
        receiptUrl: imageUrl
      }

      await cacheReceiptScan(userId, imageHash, receiptData)
      recordReceiptScan('succeeded')

      // Emit success event
      const io = getIO()
      io.to(userId).emit('receipt:scan-completed', {
        jobId: job.id,
        data: receiptData
      })

      await createSystemNotification({
        userId,
        type: 'receipt_scan.completed',
        title: 'Receipt scan completed',
        description: 'Receipt scan data is ready to review',
        severity: 'success',
        actionUrl: '/transactions',
        metadata: {
          entityType: 'receipt',
          entityId: job.id
        },
        idempotencyKey: `receipt-scan:${job.id}:completed`
      })

      // Invalidate analytics cache
      await safeInvalidateUserAnalyticsCache(userId)

      const outcome = {
        status: 'succeeded' as const,
        details: { imageHash }
      }
      observeBullMQJobProcessing(
        'receipt',
        RECEIPT_JOBS.SCAN_RECEIPT,
        'completed',
        Number(process.hrtime.bigint() - processingStartedAt) / 1_000_000_000
      )
      return outcome
    } else {
      throw new UnrecoverableError(
        'Invalid job data: missing both fileBuffer and imageUrl'
      )
    }
  } catch (error) {
    const err = error as Error
    logger.error(`[JOB:Receipt] Receipt scan failed: ${err.message}`, {
      jobId: job.id,
      correlationId,
      fileSize,
      hasFileBuffer: !!fileBuffer,
      hasImageUrl: !!imageUrl,
      error: err.message
    })

    // Catch Gemini Rate Limit (429) details
    let friendlyMessage = err.message || 'Receipt scanning failed'
    const isNonReceiptImage = err instanceof NonReceiptImageError
    const isPermanentFailure = err instanceof UnrecoverableError

    if (
      friendlyMessage.includes('429') ||
      friendlyMessage.includes('RESOURCE_EXHAUSTED')
    ) {
      friendlyMessage =
        'AI service is currently busy due to free tier limits. Please try again in 1 minute'
    }

    if (isNonReceiptImage) {
      friendlyMessage =
        'This image does not look like a receipt. Please upload a clear receipt image'
    }

    // Only emit failure on final attempt (when all attempts are exhausted)
    const maxAttempts = job.opts.attempts || 3
    const currentAttemptNumber = (job.attemptsMade ?? 0) + 1
    if (
      isNonReceiptImage ||
      isPermanentFailure ||
      currentAttemptNumber >= maxAttempts
    ) {
      recordReceiptScan('failed')
      const io = getIO()
      io.to(userId).emit('receipt:scan-failed', {
        jobId: job.id,
        error: friendlyMessage
      })

      await createSystemNotification({
        userId,
        type: 'receipt_scan.failed',
        title: 'Receipt scan failed',
        description: friendlyMessage,
        severity: 'error',
        actionUrl: '/transactions',
        metadata: {
          entityType: 'receipt',
          entityId: job.id
        },
        idempotencyKey: `receipt-scan:${job.id}:failed`
      })
    }

    if (isNonReceiptImage) {
      throw new ExpectedReceiptRejectionError(friendlyMessage)
    }

    throw error // Trigger retry for transient failures
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const receiptWorker = receiptConfig.workerEnabled
  ? new Worker(
      'RECEIPT_QUEUE',
      async (job) => {
        if (job.name === RECEIPT_JOBS.SCAN_RECEIPT) {
          return await processScanReceiptJob(job as Job<ScanReceiptJobData>)
        } else {
          const errorMsg = `Unknown job name: ${job.name}`
          logger.error(`[JOB:Receipt] ${errorMsg}`)
          throw new Error(errorMsg)
        }
      },
      {
        connection: bullMQConnection,
        concurrency: receiptConfig.workerConcurrency,
        limiter: {
          max: receiptConfig.aiRateLimitMax,
          duration: receiptConfig.aiRateLimitDurationMs
        }
      }
    )
  : null

// ─── Events ───────────────────────────────────────────────────────────────────

receiptWorker?.on('completed', (job) => {
  const result = job.returnvalue as { status?: string } | undefined
  recordBullMQJobOutcome({
    queue: 'receipt',
    jobName: job.name,
    outcome: result?.status === 'skipped' ? 'skipped' : 'completed'
  })
  logger.info(
    `[JOB:Receipt] Receipt scan completed: ${job.id} for user ${job.data.userId}`
  )
})

receiptWorker?.on('failed', (job, err) => {
  const attemptsMade = job?.attemptsMade ?? 0
  const maxAttempts = job?.opts.attempts ?? 1
  const isPermanentFailure = err instanceof UnrecoverableError
  const isRetrying = attemptsMade < maxAttempts && !isPermanentFailure
  const outcome = isPermanentFailure
    ? 'permanent_failure'
    : isRetrying
      ? 'retrying'
      : 'final_failure'

  const logMetadata = {
    error: err.message,
    userId: job?.data.userId,
    correlationId: job?.data.correlationId,
    attemptsMade,
    maxAttempts,
    ...(isRetrying && { nextRetryDelayMs: getNextRetryDelay(job) })
  }

  if (job?.processedOn) {
    observeBullMQJobProcessing(
      'receipt',
      job.name,
      outcome,
      Math.max((job.finishedOn ?? Date.now()) - job.processedOn, 0) / 1000
    )
  }

  if (isRetrying) {
    recordBullMQJobOutcome({
      queue: 'receipt',
      jobName: job?.name || 'unknown',
      outcome: 'retrying'
    })
    logger.warn(
      `[JOB:Receipt] Receipt scan retry scheduled: ${job?.id}`,
      logMetadata
    )
    return
  }

  recordBullMQJobOutcome({
    queue: 'receipt',
    jobName: job?.name || 'unknown',
    outcome
  })
  const isExpectedReceiptRejection =
    err instanceof ExpectedReceiptRejectionError
  if (!isExpectedReceiptRejection) {
    captureBackgroundError(err, {
      component: 'receipt_worker',
      eventType: isPermanentFailure
        ? 'unexpected_permanent_failure'
        : 'final_failure',
      queueName: 'receipt',
      errorClass: classifyProviderError(err),
      attempt: attemptsMade,
      maxAttempts,
      correlationId: job?.data.correlationId
    })
  }
  logger.error(`[JOB:Receipt] Receipt scan failed: ${job?.id}`, logMetadata)
})

receiptWorker?.on('error', (error) => {
  recordBullMQWorkerError('receipt', 'infrastructure')
  captureBackgroundError(error, {
    component: 'receipt_worker',
    eventType: 'infrastructure_error',
    queueName: 'receipt',
    errorClass: 'infrastructure'
  })
  logger.error('[SYS:BullMQ] Receipt worker infrastructure error', {
    queueName: 'RECEIPT_QUEUE',
    eventType: 'error',
    error: error.message,
    stack: error.stack
  })
})

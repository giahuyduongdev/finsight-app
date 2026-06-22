import { Worker, Job } from 'bullmq'
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
  getReceiptScanCacheTtlSeconds
} from '../utils/receipt/scan-cache.util'
import { uploadReceiptImageToCloudinary } from '../utils/receipt/upload.util'
import {
  extractReceiptDataFromBase64,
  NonReceiptImageError
} from '../utils/receipt/ai.util'

const MAX_RETRY_DELAY_MS = 30000

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
      error: error instanceof Error ? error.message : String(error),
      userId,
      imageHash,
      cacheKey
    })
  }
}

// ─── Job Processing ───────────────────────────────────────────────────────────

/**
 * Process receipt scanning job with async upload and cleanup
 */
async function processScanReceiptJob(job: Job<ScanReceiptJobData>) {
  const { userId, fileBuffer, imageUrl, fileName, fileSize, correlationId } =
    job.data
  const { imageHash } = job.data

  try {
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
        extractReceiptDataFromBase64(base64ForAI) // ~2000ms (bottleneck)
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

      // Emit success event
      const io = getIO()
      io.to(userId).emit('receipt:scan-completed', {
        jobId: job.id,
        data: receiptData
      })

      // Invalidate analytics cache
      await safeInvalidateUserAnalyticsCache(userId)

      return { success: true, data }
    } else if (imageUrl) {
      // Retry case: Upload succeeded but AI extraction failed
      // Download image from Cloudinary and retry AI extraction
      logger.info(
        `[JOB:Receipt] Retrying AI extraction for existing image: ${imageUrl}`
      )

      // Fetch image from Cloudinary with timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const response = await fetch(imageUrl, { signal: controller.signal })
      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(
          `Failed to fetch image from Cloudinary: ${response.statusText}`
        )
      }

      const arrayBuffer = await response.arrayBuffer()
      const imageBuffer = Buffer.from(arrayBuffer)
      base64ForAI = imageBuffer.toString('base64')

      // Retry AI extraction
      const data = await extractReceiptDataFromBase64(base64ForAI)
      const receiptData = {
        ...data,
        receiptUrl: imageUrl
      }

      await cacheReceiptScan(userId, imageHash, receiptData)

      // Emit success event
      const io = getIO()
      io.to(userId).emit('receipt:scan-completed', {
        jobId: job.id,
        data: receiptData
      })

      // Invalidate analytics cache
      await safeInvalidateUserAnalyticsCache(userId)

      return { success: true, data }
    } else {
      throw new Error('Invalid job data: missing both fileBuffer and imageUrl')
    }
  } catch (error) {
    const err = error as Error
    logger.error(`[JOB:Receipt] Receipt scan failed: ${err.message}`, {
      jobId: job.id,
      userId,
      correlationId,
      fileName,
      fileSize,
      hasFileBuffer: !!fileBuffer,
      hasImageUrl: !!imageUrl,
      error: err.message
    })

    // Catch Gemini Rate Limit (429) details
    let friendlyMessage = err.message || 'Receipt scanning failed'
    const isNonReceiptImage = err instanceof NonReceiptImageError

    if (
      friendlyMessage.includes('429') ||
      friendlyMessage.includes('RESOURCE_EXHAUSTED')
    ) {
      friendlyMessage =
        'AI service is currently busy due to free tier limits. Please try again in 1 minute'
    }

    if (isNonReceiptImage) {
      job.discard()
      friendlyMessage =
        'This image does not look like a receipt. Please upload a clear receipt image'
    }

    // Only emit failure on final attempt (when all attempts are exhausted)
    const maxAttempts = job.opts.attempts || 3
    const currentAttemptNumber = (job.attemptsMade ?? 0) + 1
    if (isNonReceiptImage || currentAttemptNumber >= maxAttempts) {
      const io = getIO()
      io.to(userId).emit('receipt:scan-failed', {
        jobId: job.id,
        error: friendlyMessage
      })
    }

    throw error // Trigger retry for transient failures
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const receiptWorker = new Worker(
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
    concurrency: 2 // Lower than transaction worker due to heavy AI processing
  }
)

// ─── Events ───────────────────────────────────────────────────────────────────

receiptWorker.on('completed', (job) => {
  logger.info(
    `[JOB:Receipt] Receipt scan completed: ${job.id} for user ${job.data.userId}`
  )
})

receiptWorker.on('failed', (job, err) => {
  const attemptsMade = job?.attemptsMade ?? 0
  const maxAttempts = job?.opts.attempts ?? 1
  const isRetrying = attemptsMade < maxAttempts

  const logMetadata = {
    error: err.message,
    userId: job?.data.userId,
    correlationId: job?.data.correlationId,
    fileName: job?.data.fileName,
    attemptsMade,
    maxAttempts,
    ...(isRetrying && { nextRetryDelayMs: getNextRetryDelay(job) })
  }

  if (isRetrying) {
    logger.warn(
      `[JOB:Receipt] Receipt scan retry scheduled: ${job?.id}`,
      logMetadata
    )
    return
  }

  logger.error(`[JOB:Receipt] Receipt scan failed: ${job?.id}`, logMetadata)
})

receiptWorker.on('error', (error) => {
  logger.error('[SYS:BullMQ] Receipt worker infrastructure error', {
    queueName: 'RECEIPT_QUEUE',
    eventType: 'error',
    error: error.message,
    stack: error.stack
  })
})

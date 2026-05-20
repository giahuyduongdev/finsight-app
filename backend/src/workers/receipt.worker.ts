import { Worker, Job } from 'bullmq'
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiResponse } from 'cloudinary'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import { generateWithFallback } from '../config/google-ai.config'
import { receiptPrompt } from '../lib/prompts/receipt.prompt'
import { getIO } from '../config/socket.config'
import { invalidateUserAnalyticsCache } from '../utils/cache.util'
import { RECEIPT_JOBS, ScanReceiptJobData } from '../queues/receipt.queue'
import { cloudinaryCircuitBreaker } from '../utils/circuitBreaker.util'

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

/**
 * Upload image buffer to Cloudinary (permanent storage)
 */
async function uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
  return cloudinaryCircuitBreaker.execute(
    () =>
      new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'receipts',
            resource_type: 'image',
            timeout: 10000
          },
          (error, result) => {
            if (error || !result) {
              reject(error || new Error('Upload failed'))
            } else {
              resolve(result)
            }
          }
        )
        uploadStream.end(buffer)
      }),
    'Cloudinary'
  )
}

/**
 * Extract receipt data using Google Gemini AI with Model/Key Fallback
 */
async function extractReceiptData(base64String: string) {
  return await generateWithFallback(
    [
      {
        role: 'user',
        parts: [
          { text: receiptPrompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64String
            }
          }
        ]
      }
    ],
    {
      temperature: 0,
      topP: 1,
      responseMimeType: 'application/json'
    }
  )
}

/**
 * Parse and validate Gemini response with strict checks
 */
function parseGeminiResponse(responseText: string) {
  const cleanedText = responseText?.replace(/```(?:json)?\n?/g, '').trim()

  if (!cleanedText) {
    throw new Error('Could not read receipt content')
  }

  const data = JSON.parse(cleanedText)

  // Strict check: amount must be a number (allow 0), date must be present
  const amount = Number(data.amount)
  if (isNaN(amount) || !data.date) {
    throw new Error('Receipt missing valid amount or date information')
  }

  // Predefined allowed values for enums
  const allowedCurrencies = ['VND', 'USD', 'EUR']
  const allowedTypes = ['EXPENSE', 'INCOME']
  const allowedStatus = ['COMPLETED', 'PENDING']

  return {
    title: (data.title || 'Receipt').substring(0, 100),
    amount: amount,
    currency: allowedCurrencies.includes(data.currency) ? data.currency : 'VND',
    date: data.date,
    description: data.description || '',
    category: data.category || 'General',
    paymentMethod: data.paymentMethod || 'CASH',
    type: allowedTypes.includes(data.type) ? data.type : 'EXPENSE',
    status: allowedStatus.includes(data.status) ? data.status : 'COMPLETED'
  }
}

// ─── Job Processing ───────────────────────────────────────────────────────────

/**
 * Process receipt scanning job with async upload and cleanup
 */
async function processScanReceiptJob(job: Job<ScanReceiptJobData>) {
  const { userId, fileBuffer, imageUrl, fileName, fileSize, correlationId } =
    job.data

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
        uploadToCloudinary(imageBuffer), // ~600ms
        extractReceiptData(base64ForAI) // ~2000ms (bottleneck)
      ])

      // Persist upload result first, even if Gemini fails
      if (uploadResult.status === 'fulfilled') {
        finalImageUrl = uploadResult.value.secure_url

        // [CLEANUP] Update job data: Replace base64 with URL to free Redis memory
        await job.updateData({
          userId,
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
        throw new Error(
          `Gemini extraction failed: ${geminiResult.reason?.message || 'Unknown error'}`
        )
      }

      // Process and validate Gemini response
      const responseText = geminiResult.value.text
      if (!responseText) {
        throw new Error('Could not read receipt content from Gemini')
      }
      const data = parseGeminiResponse(responseText)

      // Emit success event
      const io = getIO()
      io.to(userId).emit('receipt:scan-completed', {
        jobId: job.id,
        data: {
          ...data,
          receiptUrl: finalImageUrl
        }
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
      const geminiResult = await extractReceiptData(base64ForAI)
      const responseText = geminiResult.text
      if (!responseText) {
        throw new Error('Could not read receipt content from Gemini')
      }
      const data = parseGeminiResponse(responseText)

      // Emit success event
      const io = getIO()
      io.to(userId).emit('receipt:scan-completed', {
        jobId: job.id,
        data: {
          ...data,
          receiptUrl: imageUrl
        }
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
    if (
      friendlyMessage.includes('429') ||
      friendlyMessage.includes('RESOURCE_EXHAUSTED')
    ) {
      friendlyMessage =
        'AI service is currently busy due to free tier limits. Please try again in 1 minute.'
    }

    // Only emit failure on final attempt (when all attempts are exhausted)
    const maxAttempts = job.opts.attempts || 3
    if (job.attemptsMade >= maxAttempts) {
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

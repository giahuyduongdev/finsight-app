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
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Upload image buffer to Cloudinary (permanent storage)
 */
async function uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
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
  })
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
  const { userId, fileBuffer, imageUrl, fileName, fileSize } = job.data

  try {
    let finalImageUrl: string
    let base64ForAI: string

    // Check if we have base64 (first run) or URL (after cleanup/retry)
    if (fileBuffer) {
      // First run: We have base64
      const imageBuffer = Buffer.from(fileBuffer, 'base64')
      base64ForAI = fileBuffer

      // [OPTIMIZED] Upload to Cloudinary and process AI in parallel
      const [uploadResult, geminiResult] = await Promise.all([
        uploadToCloudinary(imageBuffer), // ~600ms
        extractReceiptData(base64ForAI) // ~2000ms (bottleneck)
      ])

      finalImageUrl = uploadResult.secure_url

      // [CLEANUP] Update job data: Replace base64 with URL to free Redis memory
      await job.updateData({
        userId,
        imageUrl: uploadResult.secure_url,
        fileBuffer: undefined, // Clear base64 from Redis
        fileName,
        fileSize
      })

      // Process and validate Gemini response
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
          receiptUrl: finalImageUrl
        }
      })

      // Invalidate analytics cache
      try {
        await invalidateUserAnalyticsCache(userId)
      } catch (cacheError) {
        const error = cacheError as Error
        logger.warn(
          logIcon(
            LOG_ICONS.WARNING,
            `[Worker] Cache invalidation failed for user ${userId}`
          ),
          {
            error: error.message
          }
        )
        // Continue - cache invalidation failure is non-critical
      }

      return { success: true, data }
    } else if (imageUrl) {
      // Retry case: Upload succeeded but AI extraction failed
      // Download image from Cloudinary and retry AI extraction
      logger.info(
        logIcon(
          LOG_ICONS.INFO,
          `[Worker] Retrying AI extraction for existing image: ${imageUrl}`
        )
      )

      // Fetch image from Cloudinary
      const response = await fetch(imageUrl)
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
      try {
        await invalidateUserAnalyticsCache(userId)
      } catch (cacheError) {
        const error = cacheError as Error
        logger.warn(
          logIcon(
            LOG_ICONS.WARNING,
            `[Worker] Cache invalidation failed for user ${userId}`
          ),
          {
            error: error.message
          }
        )
      }

      return { success: true, data }
    } else {
      throw new Error('Invalid job data: missing both fileBuffer and imageUrl')
    }
  } catch (error) {
    const err = error as Error
    logger.error(
      logIcon(LOG_ICONS.ERROR, `[Worker] Receipt scan failed: ${err.message}`),
      {
        jobId: job.id,
        userId,
        fileName,
        fileSize,
        hasFileBuffer: !!fileBuffer,
        hasImageUrl: !!imageUrl,
        error: err.message
      }
    )

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
      logger.warn(
        logIcon(LOG_ICONS.WARNING, `[Worker] Unknown job name: ${job.name}`)
      )
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
    logIcon(
      LOG_ICONS.SUCCESS,
      `[Worker] Receipt scan completed: ${job.id} for user ${job.data.userId}`
    )
  )
})

receiptWorker.on('failed', (job, err) => {
  logger.error(
    logIcon(LOG_ICONS.ERROR, `[Worker] Receipt scan failed: ${job?.id}`),
    {
      error: err.message,
      userId: job?.data.userId,
      fileName: job?.data.fileName,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts.attempts
    }
  )
})

import { Worker, Job } from 'bullmq'
import sharp from 'sharp'
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiResponse } from 'cloudinary'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import {
  AI_MODELS,
  getAiPool
} from '../config/google-ai.config'
import { receiptPrompt } from '../lib/prompts/receipt.prompt'
import { getIO } from '../config/socket.config'
import { invalidateUserAnalyticsCache } from '../utils/cache.util'
import { RECEIPT_JOBS, ScanReceiptJobData } from '../queues/receipt.queue'

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Upload compressed image buffer to Cloudinary
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
  const aiPool = getAiPool()
  let lastError: Error | null = null

  // Strategy: Try all API keys for each model in priority order
  for (const modelName of AI_MODELS) {
    for (let i = 0; i < aiPool.length; i++) {
      const aiInstance = aiPool[i]
      try {
        logger.info(
          `🤖 [Worker] Attempting extraction with model: ${modelName} (Key ${i + 1}/${aiPool.length})`
        )

        const result = await aiInstance.models.generateContent({
          model: modelName,
          contents: [
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
          config: {
            temperature: 0,
            topP: 1,
            responseMimeType: 'application/json',
            httpOptions: { timeout: 30000 }
          }
        })

        return result
      } catch (error: any) {
        lastError = error
        const msg = error.message || ''

        // If quota exhausted, continue to next key or model
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          logger.warn(
            `⚠️ [Worker] AI Quota reached for ${modelName} (Key ${i + 1}). Rotating...`
          )
          continue
        }

        // If it's a terminal error (invalid content, etc.), rethrow immediately
        throw error
      }
    }
  }

  throw lastError || new Error('All AI models and API keys exhausted')
}

/**
 * Parse and validate Gemini response
 */
function parseGeminiResponse(responseText: string) {
  const cleanedText = responseText?.replace(/```(?:json)?\n?/g, '').trim()

  if (!cleanedText) {
    throw new Error('Could not read receipt content')
  }

  const data = JSON.parse(cleanedText)

  if (!data.amount || !data.date) {
    throw new Error('Receipt missing required information')
  }

  return {
    title: data.title || 'Receipt',
    amount: data.amount,
    currency: data.currency || 'USD',
    date: data.date,
    description: data.description,
    category: data.category,
    paymentMethod: data.paymentMethod || 'CASH',
    type: data.type || 'EXPENSE',
    status: data.status || 'COMPLETED'
  }
}

// ─── Job Processing ───────────────────────────────────────────────────────────

/**
 * Process receipt scanning job
 */
async function processScanReceiptJob(job: Job<ScanReceiptJobData>) {
  const { userId, fileBuffer, fileName, fileSize } = job.data

  try {
    // 1. Compress image
    // Note: fileBuffer might arrive as a plain object {type: 'Buffer', data: [...]} if passed directly through BullMQ/Redis
    const actualBuffer = Buffer.isBuffer(fileBuffer)
      ? fileBuffer
      : Buffer.from((fileBuffer as any).data || (fileBuffer as any))

    const compressedBuffer = await sharp(actualBuffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()

    const base64String = compressedBuffer.toString('base64')

    // 2. Parallel execution: Upload to Cloudinary and extract with Gemini
    const [uploadResult, geminiResult] = await Promise.all([
      uploadToCloudinary(compressedBuffer),
      extractReceiptData(base64String)
    ])

    // 3. Process Gemini response
    const responseText = geminiResult.text
    if (!responseText) {
      throw new Error('Could not read receipt content from Gemini')
    }
    const data = parseGeminiResponse(responseText)

    // 4. Emit success event
    const io = getIO()
    io.to(userId).emit('receipt:scan-completed', {
      jobId: job.id,
      data: {
        ...data,
        receiptUrl: uploadResult.secure_url
      }
    })

    // 5. Invalidate analytics cache
    try {
      await invalidateUserAnalyticsCache(userId)
    } catch (cacheError) {
      const error = cacheError as Error
      logger.warn(`⚠️ [Worker] Cache invalidation failed for user ${userId}`, {
        error: error.message
      })
      // Continue - cache invalidation failure is non-critical
    }

    return { success: true, data }
  } catch (error) {
    const err = error as Error
    logger.error(`❌ [Worker] Receipt scan failed: ${err.message}`, {
      jobId: job.id,
      userId,
      fileName,
      fileSize,
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

    // 🟠 Minor: Only emit failure on final attempt
    const maxAttempts = job.opts.attempts || 3
    if (job.attemptsMade >= maxAttempts - 1) {
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
      logger.warn(`❓ [Worker] Unknown job name: ${job.name}`)
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
    `✅ [Worker] Receipt scan completed: ${job.id} for user ${job.data.userId}`
  )
})

receiptWorker.on('failed', (job, err) => {
  logger.error(`❌ [Worker] Receipt scan failed: ${job?.id}`, {
    error: err.message,
    userId: job?.data.userId,
    fileName: job?.data.fileName,
    attemptsMade: job?.attemptsMade,
    maxAttempts: job?.opts.attempts
  })
})

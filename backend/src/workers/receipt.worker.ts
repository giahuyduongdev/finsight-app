import { Worker, Job } from 'bullmq'
import sharp from 'sharp'
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiResponse } from 'cloudinary'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import {
  generateWithFallback
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
 * Process receipt scanning job
 */
async function processScanReceiptJob(job: Job<ScanReceiptJobData>) {
  const { userId, fileBuffer, fileName, fileSize } = job.data

  try {
    const actualBuffer = Buffer.from(fileBuffer, 'base64')

    const compressedBuffer = await sharp(actualBuffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()

    const base64StringForAI = compressedBuffer.toString('base64')

    // 2. [CodeRabbit] Sequential: AI Extraction & Validation FIRST
    const geminiResult = await extractReceiptData(base64StringForAI)

    // 3. Process and Validate Gemini response
    const responseText = geminiResult.text
    if (!responseText) {
      throw new Error('Could not read receipt content from Gemini')
    }
    const data = parseGeminiResponse(responseText)

    // 4. [CodeRabbit] Upload to Cloudinary only after validation succeeds
    const uploadResult = await uploadToCloudinary(compressedBuffer)

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

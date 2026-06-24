import sharp from 'sharp'
import { receiptQueue } from '../queues/receipt.queue'
import { RECEIPT_JOBS, ScanReceiptJobData } from '../queues/receipt.queue'
import { redis } from '../config/redis.config'
import {
  getReceiptCloudinaryPublicId,
  getReceiptScanCacheKey,
  hashReceiptImage,
  parseCachedReceiptScan
} from '../utils/receipt/scan-cache.util'
import {
  ReceiptImageUploadResult,
  uploadReceiptImageToCloudinary
} from '../utils/receipt/upload.util'
import {
  recordBullMQJobOutcome,
  recordReceiptCache,
  recordReceiptScan
} from '../observability'

type AddReceiptJob = (
  name: string,
  data: ScanReceiptJobData,
  options: { jobId: string }
) => Promise<{ id?: string | number | null }>

type ReceiptIntakeDependencies = {
  compressImage: (buffer: Buffer) => Promise<Buffer>
  readCache: (key: string) => Promise<string | null>
  upload: (
    buffer: Buffer,
    options: { publicId: string }
  ) => Promise<ReceiptImageUploadResult>
  addJob: AddReceiptJob
  findJob: (
    jobId: string
  ) => Promise<{ id?: string | number | null } | null | undefined>
  now: () => Date
}

export type ReceiptIntakeInput = {
  userId: string
  fileBuffer: Buffer
  fileName: string
  fileSize: number
  correlationId?: string
}

const defaultDependencies: ReceiptIntakeDependencies = {
  compressImage: (buffer) =>
    sharp(buffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer(),
  readCache: (key) => redis.get(key),
  upload: uploadReceiptImageToCloudinary,
  addJob: (name, data, options) => receiptQueue.add(name, data, options),
  findJob: (jobId) => receiptQueue.getJob(jobId),
  now: () => new Date()
}

export const buildReceiptScanJobId = (userId: string, imageHash: string) =>
  `receipt-scan-${userId}-${imageHash}`.replace(/[^a-zA-Z0-9_-]/g, '-')

export const createReceiptIntakeService = (
  dependencies: Partial<ReceiptIntakeDependencies> = {}
) => {
  const deps = { ...defaultDependencies, ...dependencies }

  return {
    async scan(input: ReceiptIntakeInput) {
      const compressedBuffer = await deps.compressImage(input.fileBuffer)
      const imageHash = hashReceiptImage(compressedBuffer)
      const cacheKey = getReceiptScanCacheKey(input.userId, imageHash)
      const rawCached = await deps.readCache(cacheKey)
      const cachedReceipt = parseCachedReceiptScan(rawCached)

      if (cachedReceipt) {
        recordReceiptCache('hit')
        recordReceiptScan('skipped')
        return {
          status: 'cached' as const,
          receipt: cachedReceipt.data
        }
      }

      recordReceiptCache(rawCached ? 'corrupt' : 'miss')

      const jobId = buildReceiptScanJobId(input.userId, imageHash)
      const existingJob = await deps.findJob(jobId)
      if (existingJob) {
        recordReceiptScan('accepted')
        return {
          status: 'accepted' as const,
          jobId: String(existingJob.id ?? jobId)
        }
      }

      const uploadResult = await deps.upload(compressedBuffer, {
        publicId: getReceiptCloudinaryPublicId(input.userId, imageHash)
      })

      await deps.addJob(
        RECEIPT_JOBS.SCAN_RECEIPT,
        {
          userId: input.userId,
          imageUrl: uploadResult.secure_url,
          imageHash,
          fileName: input.fileName,
          fileSize: input.fileSize,
          correlationId: input.correlationId,
          enqueuedAt: deps.now().toISOString()
        },
        { jobId }
      )

      recordReceiptScan('accepted')
      recordBullMQJobOutcome({
        queue: 'receipt',
        jobName: RECEIPT_JOBS.SCAN_RECEIPT,
        outcome: 'enqueued'
      })
      return {
        status: 'accepted' as const,
        jobId
      }
    }
  }
}

export const receiptIntakeService = createReceiptIntakeService()

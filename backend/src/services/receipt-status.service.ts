import { receiptQueue } from '../queues/receipt.queue'
import { redis } from '../config/redis.config'
import {
  getReceiptScanCacheKey,
  parseCachedReceiptScan
} from '../utils/receipt/scan-cache.util'
import { NotFoundException } from '../utils/errors'

type ReceiptStatusJob = {
  id?: string | number | null
  data: {
    userId: string
    imageHash?: string
  }
  getState: () => Promise<string>
  failedReason?: string
}

type ReceiptStatusDependencies = {
  getJob: (jobId: string) => Promise<ReceiptStatusJob | null | undefined>
  readCache: (key: string) => Promise<string | null>
}

const defaultDependencies: ReceiptStatusDependencies = {
  getJob: (jobId) => receiptQueue.getJob(jobId),
  readCache: (key) => redis.get(key)
}

const mapPublicStatus = (
  state: string
): 'waiting' | 'active' | 'completed' | 'failed' => {
  if (state === 'active') return 'active'
  if (state === 'completed') return 'completed'
  if (state === 'failed') return 'failed'
  return 'waiting'
}

export const createReceiptStatusService = (
  dependencies: Partial<ReceiptStatusDependencies> = {}
) => {
  const deps = { ...defaultDependencies, ...dependencies }

  return {
    async getStatus(userId: string, jobId: string) {
      const job = await deps.getJob(jobId)
      if (!job || job.data.userId !== userId) {
        throw new NotFoundException('Receipt scan job not found')
      }

      const status = mapPublicStatus(await job.getState())
      const response: {
        jobId: string
        status: 'waiting' | 'active' | 'completed' | 'failed'
        receipt?: unknown
        error?: string
      } = {
        jobId: String(job.id ?? jobId),
        status
      }

      if (status === 'completed' && job.data.imageHash) {
        const cached = parseCachedReceiptScan(
          await deps.readCache(
            getReceiptScanCacheKey(userId, job.data.imageHash)
          )
        )
        if (cached) response.receipt = cached.data
      }

      if (status === 'failed') {
        response.error = 'Receipt processing failed. Please try again.'
      }

      return response
    }
  }
}

export const receiptStatusService = createReceiptStatusService()

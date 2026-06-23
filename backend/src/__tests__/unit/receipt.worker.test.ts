const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()
const mockExtractReceipt = jest.fn()
const mockUploadReceipt = jest.fn()
const mockEmit = jest.fn()
const mockParseCachedReceipt = jest.fn()

class MockUnrecoverableError extends Error {}
class MockNonReceiptImageError extends Error {}

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({})),
  Worker: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  })),
  UnrecoverableError: MockUnrecoverableError
}))

jest.mock('../../config/bull/bullmq.config', () => ({
  bullMQConnection: {}
}))

jest.mock('../../config/logger.config', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}))

jest.mock('../../config/socket.config', () => ({
  getIO: () => ({
    to: () => ({ emit: mockEmit })
  })
}))

jest.mock('../../utils/cache.util', () => ({
  invalidateUserAnalyticsCache: jest.fn()
}))

jest.mock('../../config/redis.config', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args)
  }
}))

jest.mock('../../utils/receipt/scan-cache.util', () => ({
  getReceiptScanCacheKey: (userId: string, imageHash: string) =>
    `receipt:${userId}:${imageHash}`,
  getReceiptScanCacheTtlSeconds: () => 3600,
  getReceiptCloudinaryPublicId: () => 'receipt-public-id',
  parseCachedReceiptScan: (...args: unknown[]) =>
    mockParseCachedReceipt(...args)
}))

jest.mock('../../utils/receipt/upload.util', () => ({
  uploadReceiptImageToCloudinary: (...args: unknown[]) =>
    mockUploadReceipt(...args)
}))

jest.mock('../../utils/receipt/ai.util', () => ({
  extractReceiptDataFromBase64: (...args: unknown[]) =>
    mockExtractReceipt(...args),
  NonReceiptImageError: MockNonReceiptImageError
}))

import { processScanReceiptJob } from '../../workers/receipt.worker'

const createJob = () =>
  ({
    id: 'receipt-job-1',
    data: {
      userId: 'user-123',
      imageHash: 'image-hash',
      fileBuffer: Buffer.from('receipt').toString('base64'),
      fileName: 'receipt.jpg',
      fileSize: 100
    },
    opts: { attempts: 3 },
    attemptsMade: 0,
    updateData: jest.fn(),
    discard: jest.fn()
  }) as never

describe('receipt worker reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockParseCachedReceipt.mockReturnValue(null)
    mockUploadReceipt.mockResolvedValue({
      secure_url: 'https://example.com/receipt.jpg'
    })
    mockExtractReceipt.mockResolvedValue({
      merchant: 'Store',
      amount: 10
    })
  })

  it('reuses a durable cached scan result on replay', async () => {
    const cached = {
      data: {
        merchant: 'Store',
        amount: 10,
        receiptUrl: 'https://example.com/receipt.jpg'
      }
    }
    mockRedisGet.mockResolvedValue(JSON.stringify(cached))
    mockParseCachedReceipt.mockReturnValue(cached)

    await expect(processScanReceiptJob(createJob())).resolves.toEqual({
      status: 'skipped',
      reason: 'receipt-scan-cache-hit',
      details: { imageHash: 'image-hash' }
    })

    expect(mockExtractReceipt).not.toHaveBeenCalled()
    expect(mockUploadReceipt).not.toHaveBeenCalled()
    expect(mockEmit).toHaveBeenCalledWith('receipt:scan-completed', {
      jobId: 'receipt-job-1',
      data: cached.data
    })
  })

  it('marks a non-receipt image as permanently failed', async () => {
    mockExtractReceipt.mockRejectedValue(
      new MockNonReceiptImageError('Not a receipt')
    )

    await expect(processScanReceiptJob(createJob())).rejects.toBeInstanceOf(
      MockUnrecoverableError
    )
  })

  it('treats a corrupted cache entry as a cache miss', async () => {
    mockRedisGet.mockResolvedValue('corrupted-cache')
    mockParseCachedReceipt.mockImplementation(() => {
      throw new Error('Invalid cached receipt')
    })

    await expect(processScanReceiptJob(createJob())).resolves.toEqual({
      success: true,
      data: {
        merchant: 'Store',
        amount: 10
      }
    })
    expect(mockExtractReceipt).toHaveBeenCalled()
    expect(mockUploadReceipt).toHaveBeenCalled()
  })

  it('keeps transient provider failures retryable', async () => {
    const transientError = new Error('Gemini temporarily unavailable')
    mockExtractReceipt.mockRejectedValue(transientError)

    await expect(processScanReceiptJob(createJob())).rejects.toThrow(
      'Gemini extraction failed: Gemini temporarily unavailable'
    )
  })
})

import type { CachedReceiptScanData } from '../../../utils/receipt/scan-cache.util'

jest.mock('../../../queues/receipt.queue', () => ({
  RECEIPT_JOBS: { SCAN_RECEIPT: 'scan-receipt' },
  receiptQueue: { add: jest.fn(), getJob: jest.fn() }
}))

jest.mock('../../../config/redis.config', () => ({
  redis: { get: jest.fn() }
}))

const cachedReceipt: CachedReceiptScanData = {
  title: 'Coffee',
  amount: 50000,
  currency: 'VND',
  date: '2026-06-23T00:00:00.000Z',
  description: '',
  category: 'dining',
  paymentMethod: 'CASH',
  type: 'EXPENSE',
  status: 'COMPLETED',
  receiptUrl: 'https://res.cloudinary.com/demo/receipt.jpg'
}

describe('receipt intake service', () => {
  it('returns a cached result without upload or enqueue', async () => {
    const upload = jest.fn()
    const addJob = jest.fn()
    const { createReceiptIntakeService } =
      await import('../../../services/receipt-intake.service')
    const service = createReceiptIntakeService({
      compressImage: async () => Buffer.from('compressed'),
      readCache: async () =>
        JSON.stringify({
          data: cachedReceipt,
          cachedAt: new Date().toISOString()
        }),
      upload,
      addJob,
      findJob: async () => null
    })

    await expect(
      service.scan({
        userId: 'user-123',
        fileBuffer: Buffer.from('raw'),
        fileName: 'receipt.jpg',
        fileSize: 3,
        correlationId: 'req-123'
      })
    ).resolves.toEqual({
      status: 'cached',
      receipt: cachedReceipt
    })
    expect(upload).not.toHaveBeenCalled()
    expect(addJob).not.toHaveBeenCalled()
  })

  it('uploads before enqueueing a URL-only job with stable identity', async () => {
    const calls: string[] = []
    const addJob = jest.fn(async (_name, data, options) => {
      calls.push('enqueue')
      return { id: options.jobId, data }
    })
    const { buildReceiptScanJobId, createReceiptIntakeService } =
      await import('../../../services/receipt-intake.service')
    const service = createReceiptIntakeService({
      compressImage: async () => Buffer.from('compressed'),
      readCache: async () => null,
      upload: async () => {
        calls.push('upload')
        return {
          secure_url: 'https://res.cloudinary.com/demo/receipt.jpg',
          public_id: 'receipts/user/hash'
        }
      },
      addJob,
      findJob: async () => null,
      now: () => new Date('2026-06-23T00:00:00.000Z')
    })

    const result = await service.scan({
      userId: 'user-123',
      fileBuffer: Buffer.from('raw'),
      fileName: 'receipt.jpg',
      fileSize: 3,
      correlationId: 'req-123'
    })

    expect(calls).toEqual(['upload', 'enqueue'])
    expect(result).toEqual({
      status: 'accepted',
      jobId: expect.stringMatching(/^receipt-scan-user-123-[a-f0-9]{64}$/)
    })
    expect(addJob).toHaveBeenCalledWith(
      'scan-receipt',
      expect.objectContaining({
        userId: 'user-123',
        imageUrl: 'https://res.cloudinary.com/demo/receipt.jpg',
        imageHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        enqueuedAt: '2026-06-23T00:00:00.000Z'
      }),
      {
        jobId: buildReceiptScanJobId(
          'user-123',
          addJob.mock.calls[0][1].imageHash
        )
      }
    )
    expect(addJob.mock.calls[0][1]).not.toHaveProperty('fileBuffer')
  })

  it('does not enqueue when Cloudinary upload fails', async () => {
    const addJob = jest.fn()
    const uploadError = new Error('cloudinary down')
    const { createReceiptIntakeService } =
      await import('../../../services/receipt-intake.service')
    const service = createReceiptIntakeService({
      compressImage: async () => Buffer.from('compressed'),
      readCache: async () => null,
      upload: async () => {
        throw uploadError
      },
      addJob,
      findJob: async () => null
    })

    await expect(
      service.scan({
        userId: 'user-123',
        fileBuffer: Buffer.from('raw'),
        fileName: 'receipt.jpg',
        fileSize: 3
      })
    ).rejects.toBe(uploadError)
    expect(addJob).not.toHaveBeenCalled()
  })

  it('does not report acceptance when enqueue fails', async () => {
    const enqueueError = new Error('redis unavailable')
    const { createReceiptIntakeService } =
      await import('../../../services/receipt-intake.service')
    const service = createReceiptIntakeService({
      compressImage: async () => Buffer.from('compressed'),
      readCache: async () => null,
      upload: async () => ({
        secure_url: 'https://res.cloudinary.com/demo/receipt.jpg',
        public_id: 'receipts/user/hash'
      }),
      addJob: async () => {
        throw enqueueError
      },
      findJob: async () => null
    })

    await expect(
      service.scan({
        userId: 'user-123',
        fileBuffer: Buffer.from('raw'),
        fileName: 'receipt.jpg',
        fileSize: 3
      })
    ).rejects.toBe(enqueueError)
  })

  it('returns the existing stable job without another upload', async () => {
    const upload = jest.fn()
    const addJob = jest.fn()
    const { createReceiptIntakeService } =
      await import('../../../services/receipt-intake.service')
    const service = createReceiptIntakeService({
      compressImage: async () => Buffer.from('compressed'),
      readCache: async () => null,
      upload,
      addJob,
      findJob: async () => ({ id: 'existing-receipt-job' })
    })

    await expect(
      service.scan({
        userId: 'user-123',
        fileBuffer: Buffer.from('raw'),
        fileName: 'receipt.jpg',
        fileSize: 3
      })
    ).resolves.toEqual({
      status: 'accepted',
      jobId: 'existing-receipt-job'
    })
    expect(upload).not.toHaveBeenCalled()
    expect(addJob).not.toHaveBeenCalled()
  })
})

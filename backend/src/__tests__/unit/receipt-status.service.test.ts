import { NotFoundException } from '../../utils/errors'

jest.mock('../../queues/receipt.queue', () => ({
  receiptQueue: { getJob: jest.fn() }
}))

jest.mock('../../config/redis.config', () => ({
  redis: { get: jest.fn() }
}))

describe('receipt scan status service', () => {
  it('returns a cached completed result for the owning user', async () => {
    const cached = {
      data: {
        title: 'Coffee',
        amount: 50000,
        currency: 'VND',
        date: '2026-06-23T00:00:00.000Z',
        description: '',
        category: 'dining',
        paymentMethod: 'CASH',
        type: 'EXPENSE',
        status: 'COMPLETED',
        receiptUrl: 'https://example.com/receipt.jpg'
      },
      cachedAt: '2026-06-23T00:00:00.000Z'
    }
    const { createReceiptStatusService } =
      await import('../../services/receipt-status.service')
    const service = createReceiptStatusService({
      getJob: async () => ({
        id: 'receipt-job-1',
        data: { userId: 'user-123', imageHash: 'hash' },
        getState: async () => 'completed',
        failedReason: undefined
      }),
      readCache: async () => JSON.stringify(cached)
    })

    await expect(
      service.getStatus('user-123', 'receipt-job-1')
    ).resolves.toEqual({
      jobId: 'receipt-job-1',
      status: 'completed',
      receipt: cached.data
    })
  })

  it('does not reveal jobs belonging to another user', async () => {
    const { createReceiptStatusService } =
      await import('../../services/receipt-status.service')
    const service = createReceiptStatusService({
      getJob: async () => ({
        id: 'receipt-job-1',
        data: { userId: 'another-user', imageHash: 'hash' },
        getState: async () => 'active',
        failedReason: undefined
      }),
      readCache: async () => null
    })

    await expect(
      service.getStatus('user-123', 'receipt-job-1')
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it.each([
    ['waiting', 'waiting'],
    ['delayed', 'waiting'],
    ['prioritized', 'waiting'],
    ['active', 'active'],
    ['completed', 'completed'],
    ['failed', 'failed']
  ] as const)(
    'maps BullMQ state %s to public state %s',
    async (state, status) => {
      const { createReceiptStatusService } =
        await import('../../services/receipt-status.service')
      const service = createReceiptStatusService({
        getJob: async () => ({
          id: 'receipt-job-1',
          data: { userId: 'user-123' },
          getState: async () => state,
          failedReason: 'provider details should not leak'
        }),
        readCache: async () => null
      })

      await expect(
        service.getStatus('user-123', 'receipt-job-1')
      ).resolves.toEqual({
        jobId: 'receipt-job-1',
        status,
        ...(status === 'failed'
          ? { error: 'Receipt processing failed. Please try again.' }
          : {})
      })
    }
  )
})

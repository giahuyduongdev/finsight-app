const mockQueue = jest.fn()

jest.mock('bullmq', () => ({
  Queue: mockQueue
}))

jest.mock('../../config/bull/bullmq.config', () => ({
  bullMQConnection: {}
}))

describe('BullMQ backoff configuration', () => {
  beforeEach(() => {
    jest.resetModules()
    mockQueue.mockClear()
    mockQueue.mockImplementation(() => ({}))
  })

  it('should configure receipt queue exponential backoff and retention', async () => {
    await import('../../queues/receipt.queue')

    expect(mockQueue).toHaveBeenCalledWith(
      'RECEIPT_QUEUE',
      expect.objectContaining({
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: {
            count: 100,
            age: 24 * 3600
          },
          removeOnFail: {
            count: 50,
            age: 7 * 24 * 3600
          }
        }
      })
    )
  })

  it('should configure report queue exponential backoff and retention', async () => {
    await import('../../queues/report.queue')

    expect(mockQueue).toHaveBeenCalledWith(
      'REPORT_QUEUE',
      expect.objectContaining({
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: {
            count: 100,
            age: 24 * 3600
          },
          removeOnFail: {
            count: 50,
            age: 7 * 24 * 3600
          }
        }
      })
    )
  })
})

export {}

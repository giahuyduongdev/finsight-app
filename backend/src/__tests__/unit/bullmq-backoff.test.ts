const mockQueue = jest.fn()

jest.mock('bullmq', () => ({
  Queue: mockQueue
}))

jest.mock('../../config/bull/bullmq.config', () => ({
  bullMQConnection: {}
}))

const DAY_SECONDS = 24 * 3600
const WEEK_SECONDS = 7 * DAY_SECONDS

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
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: {
            count: 100,
            age: DAY_SECONDS
          },
          removeOnFail: {
            count: 50,
            age: WEEK_SECONDS
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
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: {
            count: 100,
            age: DAY_SECONDS
          },
          removeOnFail: {
            count: 50,
            age: WEEK_SECONDS
          }
        }
      })
    )
  })
})

export {}

const mockQueue = jest.fn()
const mockWorker = jest.fn()
const mockLoggerWarn = jest.fn()
const mockLoggerError = jest.fn()
const workerHandlers = new Map<string, (job: unknown, error: Error) => void>()

jest.mock('../../config/logger.config', () => ({
  logger: {
    warn: mockLoggerWarn,
    error: mockLoggerError,
    info: jest.fn(),
    debug: jest.fn()
  }
}))

jest.mock('bullmq', () => ({
  Queue: mockQueue,
  Worker: mockWorker.mockImplementation(() => ({
    on: jest.fn(
      (event: string, handler: (job: unknown, error: Error) => void) => {
        workerHandlers.set(event, handler)
      }
    )
  })),
  FlowProducer: jest.fn().mockImplementation(() => ({
    close: jest.fn()
  }))
}))

jest.mock('../../config/bull/bullmq.config', () => ({
  bullMQConnection: {
    on: jest.fn(),
    quit: jest.fn()
  }
}))

jest.mock('../../config/socket.config', () => ({
  getIO: () => ({
    to: jest.fn().mockReturnValue({ emit: jest.fn() })
  })
}))

jest.mock('../../config/google-ai.config', () => ({
  generateWithFallback: jest.fn()
}))

jest.mock('../../lib/prompts/receipt.prompt', () => ({
  receiptPrompt: 'test receipt prompt'
}))

jest.mock('../../utils/cache.util', () => ({
  invalidateUserAnalyticsCache: jest.fn()
}))

jest.mock('../../mailers/report.mailer', () => ({
  sendReportEmail: jest.fn()
}))

jest.mock('../../models/user.model', () => ({
  __esModule: true,
  default: { findById: jest.fn() }
}))

jest.mock('../../models/report.model', () => ({
  __esModule: true,
  default: { create: jest.fn() },
  ReportStatusEnum: {
    SENT: 'SENT',
    FAILED: 'FAILED',
    NO_ACTIVITY: 'NO_ACTIVITY'
  }
}))

jest.mock('../../models/report-setting.model', () => ({
  __esModule: true,
  default: { updateOne: jest.fn() }
}))

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn(),
      endSession: jest.fn()
    })
  }
}))

jest.mock('../../services/report.service', () => ({
  generateReportService: jest.fn()
}))

jest.mock('../../utils/dates/index', () => ({
  calculateNextReportDate: jest.fn()
}))

describe('BullMQ backoff integration', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    workerHandlers.clear()
    mockQueue.mockImplementation(() => ({ close: jest.fn() }))
  })

  it('should configure queue retries, exponential backoff, and retention windows', async () => {
    await import('../../queues/receipt.queue')
    await import('../../queues/report.queue')

    expect(mockQueue).toHaveBeenCalledWith(
      'RECEIPT_QUEUE',
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: { count: 100, age: 24 * 3600 },
          removeOnFail: { count: 50, age: 7 * 24 * 3600 }
        })
      })
    )
    expect(mockQueue).toHaveBeenCalledWith(
      'REPORT_QUEUE',
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100, age: 24 * 3600 },
          removeOnFail: { count: 50, age: 7 * 24 * 3600 }
        })
      })
    )
  })

  it('should log receipt retry attempts with correlation ID and exponential delays', async () => {
    await import('../../workers/receipt.worker')
    const failedHandler = workerHandlers.get('failed')
    expect(failedHandler).toBeDefined()

    const baseJob = {
      id: 'receipt-job-1',
      data: {
        userId: 'user-123',
        correlationId: 'correlation-123',
        fileName: 'receipt.jpg'
      },
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 }
      }
    }

    failedHandler?.({ ...baseJob, attemptsMade: 1 }, new Error('first fail'))
    failedHandler?.({ ...baseJob, attemptsMade: 2 }, new Error('second fail'))
    failedHandler?.({ ...baseJob, attemptsMade: 10 }, new Error('late fail'))

    expect(mockLoggerWarn).toHaveBeenNthCalledWith(
      1,
      '[JOB:Receipt] Receipt scan retry scheduled: receipt-job-1',
      expect.objectContaining({
        correlationId: 'correlation-123',
        attemptsMade: 1,
        maxAttempts: 3,
        nextRetryDelayMs: 10000
      })
    )
    expect(mockLoggerWarn).toHaveBeenNthCalledWith(
      2,
      '[JOB:Receipt] Receipt scan retry scheduled: receipt-job-1',
      expect.objectContaining({
        correlationId: 'correlation-123',
        attemptsMade: 2,
        maxAttempts: 3,
        nextRetryDelayMs: 20000
      })
    )
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[JOB:Receipt] Receipt scan failed: receipt-job-1',
      expect.objectContaining({
        correlationId: 'correlation-123',
        attemptsMade: 10,
        maxAttempts: 3
      })
    )
  })

  it('should log report retry attempts with correlation ID and cap next delay at 30 seconds', async () => {
    await import('../../workers/report.worker')
    const failedHandler = workerHandlers.get('failed')
    expect(failedHandler).toBeDefined()

    const baseJob = {
      id: 'report-job-1',
      data: {
        userId: 'user-123',
        correlationId: 'correlation-456'
      },
      opts: {
        attempts: 20,
        backoff: { type: 'exponential', delay: 5000 }
      }
    }

    failedHandler?.({ ...baseJob, attemptsMade: 1 }, new Error('first fail'))
    failedHandler?.({ ...baseJob, attemptsMade: 2 }, new Error('second fail'))
    failedHandler?.({ ...baseJob, attemptsMade: 3 }, new Error('third fail'))
    failedHandler?.({ ...baseJob, attemptsMade: 10 }, new Error('late fail'))

    expect(mockLoggerWarn).toHaveBeenNthCalledWith(
      1,
      '[JOB:Report] Report retry scheduled: report-job-1',
      expect.objectContaining({
        correlationId: 'correlation-456',
        attemptsMade: 1,
        nextRetryDelayMs: 5000
      })
    )
    expect(mockLoggerWarn).toHaveBeenNthCalledWith(
      2,
      '[JOB:Report] Report retry scheduled: report-job-1',
      expect.objectContaining({
        correlationId: 'correlation-456',
        attemptsMade: 2,
        nextRetryDelayMs: 10000
      })
    )
    expect(mockLoggerWarn).toHaveBeenNthCalledWith(
      3,
      '[JOB:Report] Report retry scheduled: report-job-1',
      expect.objectContaining({
        correlationId: 'correlation-456',
        attemptsMade: 3,
        nextRetryDelayMs: 20000
      })
    )
    expect(mockLoggerWarn).toHaveBeenNthCalledWith(
      4,
      '[JOB:Report] Report retry scheduled: report-job-1',
      expect.objectContaining({
        correlationId: 'correlation-456',
        attemptsMade: 10,
        nextRetryDelayMs: 30000
      })
    )
  })
})

export {}

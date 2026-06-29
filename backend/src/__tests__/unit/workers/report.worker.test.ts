const mockQueue = jest.fn()
const mockWorker = jest.fn()
const mockGenerateReportService = jest.fn()
const mockSendReportEmail = jest.fn()
const mockReportFindOneAndUpdate = jest.fn()
const mockReportUpdateOne = jest.fn()
const mockReportSettingUpdateOne = jest.fn()
const mockUserLean = jest.fn()
const mockUserFindById = jest.fn((_userId?: unknown) => ({
  lean: mockUserLean
}))
const mockCalculateNextReportDate = jest.fn()
const mockEmit = jest.fn()
const mockTo = jest.fn(() => ({ emit: mockEmit }))
const mockLoggerWarn = jest.fn()
const mockLoggerError = jest.fn()
const mockWorkerOn = jest.fn()
const workerEventHandlers = new Map<string, (...args: unknown[]) => void>()

jest.mock('bullmq', () => ({
  Queue: mockQueue.mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn()
  })),
  Worker: mockWorker.mockImplementation(() => ({
    on: mockWorkerOn.mockImplementation(
      (event: string, handler: (...args: unknown[]) => void) => {
        workerEventHandlers.set(event, handler)
      }
    ),
    close: jest.fn()
  }))
}))

jest.mock('../../../config/bull/bullmq.config', () => ({
  bullMQConnection: {
    on: jest.fn(),
    quit: jest.fn()
  }
}))

jest.mock('../../../config/logger.config', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

jest.mock('../../../config/socket.config', () => ({
  getIO: () => ({
    to: mockTo
  })
}))

jest.mock('../../../config/google-ai.config', () => ({
  generateWithFallback: jest.fn()
}))

jest.mock('../../../services/report.service', () => ({
  generateReportService: (...args: unknown[]) =>
    mockGenerateReportService(...args)
}))

jest.mock('../../../mailers/report.mailer', () => ({
  sendReportEmail: (...args: unknown[]) => mockSendReportEmail(...args)
}))

jest.mock('../../../models/user.model', () => ({
  __esModule: true,
  default: {
    findById: (userId: unknown) => mockUserFindById(userId)
  }
}))

jest.mock('../../../models/report.model', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: (...args: unknown[]) =>
      mockReportFindOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => mockReportUpdateOne(...args)
  },
  ReportStatusEnum: {
    SENT: 'SENT',
    PENDING: 'PENDING',
    FAILED: 'FAILED',
    NO_ACTIVITY: 'NO_ACTIVITY'
  }
}))

jest.mock('../../../models/report-setting.model', () => ({
  __esModule: true,
  default: {
    updateOne: (...args: unknown[]) => mockReportSettingUpdateOne(...args)
  }
}))

jest.mock('../../../utils/dates/index', () => ({
  calculateNextReportDate: (...args: unknown[]) =>
    mockCalculateNextReportDate(...args)
}))

const mockSession = {
  withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
  endSession: jest.fn()
}

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    startSession: jest.fn(() => Promise.resolve(mockSession))
  }
}))

import { processReportJob } from '../../../workers/report.worker'

const createJob = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'report-job-1',
    data: {
      userId: 'user-123',
      settingId: 'setting-123',
      timezone: 'Asia/Ho_Chi_Minh',
      preferredCurrency: 'USD',
      frequency: 'MONTHLY',
      dueDate: '2026-06-01T00:00:00.000Z',
      correlationId: 'correlation-123',
      ...overrides
    },
    attemptsMade: 0,
    attemptsStarted: 1,
    opts: {
      attempts: 3
    }
  }) as never

const createGeneratedReport = () => ({
  period: 'May 1 - 31, 2026',
  summary: {
    income: 1000,
    expenses: 500,
    balance: 500,
    savingsRate: 50,
    topCategories: []
  },
  insights: ['Good month'],
  currency: 'USD'
})

const createPersistedReport = (
  status: 'PENDING' | 'SENT' | 'FAILED' | 'NO_ACTIVITY',
  id = `report-${status.toLowerCase()}`
) => ({
  _id: { toString: () => id },
  userId: 'user-123',
  period: 'May 1 - 31, 2026',
  status
})

describe('report.worker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserLean.mockResolvedValue({
      email: 'user@example.com',
      name: 'Test User'
    })
    mockSendReportEmail.mockResolvedValue({
      data: { id: 'provider-message-123' },
      error: null
    })
    mockReportFindOneAndUpdate.mockResolvedValue(
      createPersistedReport('PENDING', 'report-delivery')
    )
    mockReportUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    mockCalculateNextReportDate.mockReturnValue(
      new Date('2026-07-01T00:00:00.000Z')
    )
    mockReportSettingUpdateOne.mockResolvedValue({ modifiedCount: 1 })
  })

  it('emits report list update after persisting a sent report', async () => {
    mockGenerateReportService.mockResolvedValue(createGeneratedReport())

    await processReportJob(createJob())

    expect(mockSendReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'report/setting-123/2026-06-01T00:00:00.000Z'
      })
    )
    expect(mockReportUpdateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'SENT',
          providerMessageId: 'provider-message-123'
        })
      }),
      expect.any(Object)
    )
    expect(mockTo).toHaveBeenCalledWith('user-123')
    expect(mockEmit).toHaveBeenCalledWith('report:list-updated', {
      userId: 'user-123',
      reason: 'generated',
      reportId: 'report-delivery',
      status: 'SENT',
      period: 'May 1 - 31, 2026',
      source: 'worker',
      updatedAt: expect.any(String)
    })
  })

  it('registers an infrastructure error listener for the report worker', () => {
    expect(workerEventHandlers.get('error')).toEqual(expect.any(Function))
  })

  it('skips a replay when the scheduled delivery is already sent', async () => {
    mockReportFindOneAndUpdate.mockResolvedValue(
      createPersistedReport('SENT', 'report-existing')
    )

    await expect(processReportJob(createJob())).resolves.toEqual({
      status: 'skipped',
      reason: 'delivery-already-terminal',
      details: {
        deliveryKey: 'report/setting-123/2026-06-01T00:00:00.000Z',
        reportId: 'report-existing'
      }
    })

    expect(mockGenerateReportService).not.toHaveBeenCalled()
    expect(mockSendReportEmail).not.toHaveBeenCalled()
    expect(mockReportUpdateOne).not.toHaveBeenCalled()
  })

  it('emits report list update after persisting a no-activity report', async () => {
    mockGenerateReportService.mockResolvedValue(null)

    await processReportJob(createJob())

    expect(mockSendReportEmail).not.toHaveBeenCalled()
    expect(mockReportUpdateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'NO_ACTIVITY' })
      }),
      expect.any(Object)
    )
    expect(mockEmit).toHaveBeenCalledWith('report:list-updated', {
      userId: 'user-123',
      reason: 'generated',
      reportId: 'report-delivery',
      status: 'NO_ACTIVITY',
      period: 'May 1–31, 2026',
      source: 'worker',
      updatedAt: expect.any(String)
    })
  })

  it('records an attempt failure without emitting a terminal notification', async () => {
    const emailError = new Error('Email provider unavailable')
    mockGenerateReportService.mockResolvedValue(createGeneratedReport())
    mockSendReportEmail.mockRejectedValue(emailError)

    await expect(processReportJob(createJob())).rejects.toThrow(
      'Email provider unavailable'
    )

    expect(mockReportUpdateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      expect.objectContaining({
        $inc: { attemptCount: 1 },
        $set: expect.objectContaining({
          lastError: 'Email provider unavailable'
        })
      })
    )
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('reuses the provider idempotency key after a crash before DB commit', async () => {
    mockGenerateReportService.mockResolvedValue(createGeneratedReport())
    mockReportUpdateOne
      .mockRejectedValueOnce(new Error('Database commit failed'))
      .mockResolvedValue({ modifiedCount: 1 })

    await expect(processReportJob(createJob())).rejects.toThrow(
      'Database commit failed'
    )
    await expect(processReportJob(createJob())).resolves.toEqual(
      expect.objectContaining({ status: 'succeeded' })
    )

    expect(mockSendReportEmail).toHaveBeenCalledTimes(2)
    expect(mockSendReportEmail.mock.calls[0][0].idempotencyKey).toBe(
      'report/setting-123/2026-06-01T00:00:00.000Z'
    )
    expect(mockSendReportEmail.mock.calls[1][0].idempotencyKey).toBe(
      mockSendReportEmail.mock.calls[0][0].idempotencyKey
    )
  })

  it('persists and emits terminal failure only after the final attempt', async () => {
    const failedHandler = workerEventHandlers.get('failed')
    const job = createJob()
    Object.assign(job, { attemptsMade: 3 })

    await failedHandler?.(job, new Error('Email provider unavailable'))

    expect(mockReportUpdateOne).toHaveBeenCalledWith(
      {
        deliveryKey: 'report/setting-123/2026-06-01T00:00:00.000Z'
      },
      {
        $set: expect.objectContaining({
          status: 'FAILED',
          lastError: 'Email provider unavailable'
        })
      },
      expect.any(Object)
    )
    expect(mockEmit).toHaveBeenCalledWith(
      'report:list-updated',
      expect.objectContaining({
        userId: 'user-123',
        status: 'FAILED',
        source: 'worker'
      })
    )
    expect(mockReportSettingUpdateOne).toHaveBeenCalledWith(
      { _id: 'setting-123' },
      {
        $set: {
          nextReportDate: new Date('2026-07-01T00:00:00.000Z'),
          updatedAt: expect.any(Date)
        }
      },
      expect.any(Object)
    )
  })
})

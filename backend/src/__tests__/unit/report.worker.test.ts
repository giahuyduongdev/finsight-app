const mockQueue = jest.fn()
const mockWorker = jest.fn()
const mockGenerateReportService = jest.fn()
const mockSendReportEmail = jest.fn()
const mockReportCreate = jest.fn()
const mockReportSettingUpdateOne = jest.fn()
const mockUserLean = jest.fn()
const mockUserFindById = jest.fn((_userId?: unknown) => ({
  lean: mockUserLean
}))
const mockCalculateNextReportDate = jest.fn()
const mockEmit = jest.fn()
const mockTo = jest.fn(() => ({ emit: mockEmit }))
const mockLoggerWarn = jest.fn()

jest.mock('bullmq', () => ({
  Queue: mockQueue.mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn()
  })),
  Worker: mockWorker.mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}))

jest.mock('../../config/bull/bullmq.config', () => ({
  bullMQConnection: {
    on: jest.fn(),
    quit: jest.fn()
  }
}))

jest.mock('../../config/logger.config', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

jest.mock('../../config/socket.config', () => ({
  getIO: () => ({
    to: mockTo
  })
}))

jest.mock('../../config/google-ai.config', () => ({
  generateWithFallback: jest.fn()
}))

jest.mock('../../services/report.service', () => ({
  generateReportService: (...args: unknown[]) =>
    mockGenerateReportService(...args)
}))

jest.mock('../../mailers/report.mailer', () => ({
  sendReportEmail: (...args: unknown[]) => mockSendReportEmail(...args)
}))

jest.mock('../../models/user.model', () => ({
  __esModule: true,
  default: {
    findById: (userId: unknown) => mockUserFindById(userId)
  }
}))

jest.mock('../../models/report.model', () => ({
  __esModule: true,
  default: {
    create: (...args: unknown[]) => mockReportCreate(...args)
  },
  ReportStatusEnum: {
    SENT: 'SENT',
    PENDING: 'PENDING',
    FAILED: 'FAILED',
    NO_ACTIVITY: 'NO_ACTIVITY'
  }
}))

jest.mock('../../models/report-setting.model', () => ({
  __esModule: true,
  default: {
    updateOne: (...args: unknown[]) => mockReportSettingUpdateOne(...args)
  }
}))

jest.mock('../../utils/dates/index', () => ({
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

import { processReportJob } from '../../workers/report.worker'

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
  status: 'SENT' | 'FAILED' | 'NO_ACTIVITY',
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
    mockSendReportEmail.mockResolvedValue(undefined)
    mockCalculateNextReportDate.mockReturnValue(
      new Date('2026-07-01T00:00:00.000Z')
    )
    mockReportSettingUpdateOne.mockResolvedValue({ modifiedCount: 1 })
  })

  it('emits report list update after persisting a sent report', async () => {
    mockGenerateReportService.mockResolvedValue(createGeneratedReport())
    mockReportCreate.mockResolvedValue([createPersistedReport('SENT')])

    await processReportJob(createJob())

    expect(mockReportCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ status: 'SENT' })],
      expect.any(Object)
    )
    expect(mockTo).toHaveBeenCalledWith('user-123')
    expect(mockEmit).toHaveBeenCalledWith('report:list-updated', {
      userId: 'user-123',
      reason: 'generated',
      reportId: 'report-sent',
      status: 'SENT',
      period: 'May 1 - 31, 2026',
      source: 'worker',
      updatedAt: expect.any(String)
    })
  })

  it('emits report list update after persisting a no-activity report', async () => {
    mockGenerateReportService.mockResolvedValue(null)
    mockReportCreate.mockResolvedValue([
      createPersistedReport('NO_ACTIVITY', 'report-no-activity')
    ])

    await processReportJob(createJob())

    expect(mockSendReportEmail).not.toHaveBeenCalled()
    expect(mockReportCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ status: 'NO_ACTIVITY' })],
      expect.any(Object)
    )
    expect(mockEmit).toHaveBeenCalledWith('report:list-updated', {
      userId: 'user-123',
      reason: 'generated',
      reportId: 'report-no-activity',
      status: 'NO_ACTIVITY',
      period: 'May 1 - 31, 2026',
      source: 'worker',
      updatedAt: expect.any(String)
    })
  })

  it('emits failed report update after persisting email failure and still rejects', async () => {
    const emailError = new Error('Email provider unavailable')
    mockGenerateReportService.mockResolvedValue(createGeneratedReport())
    mockSendReportEmail.mockRejectedValue(emailError)
    mockReportCreate.mockResolvedValue([createPersistedReport('FAILED')])

    await expect(processReportJob(createJob())).rejects.toThrow(
      'Email provider unavailable'
    )

    expect(mockReportCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ status: 'FAILED' })],
      expect.any(Object)
    )
    expect(mockEmit).toHaveBeenCalledWith('report:list-updated', {
      userId: 'user-123',
      reason: 'generated',
      reportId: 'report-failed',
      status: 'FAILED',
      period: 'May 1 - 31, 2026',
      source: 'worker',
      updatedAt: expect.any(String)
    })
  })
})

const mockWorkerOn = jest.fn()
const mockFindBatchById = jest.fn()
const mockClaimBatch = jest.fn()
const mockUpdateBatchStatus = jest.fn()
const mockUpdateBatchProgress = jest.fn()
const mockRemoveTransactionsArray = jest.fn()
const mockBulkCreate = jest.fn()
const mockInvalidateAnalytics = jest.fn()
const mockEmit = jest.fn()
const mockTransactionFindOne = jest.fn()
const mockTransactionCreate = jest.fn()
const mockTransactionUpdateOne = jest.fn()
const mockTransactionExists = jest.fn()
const mockCalculateNextOccurrence = jest.fn()
const workerEventHandlers = new Map<string, (...args: unknown[]) => unknown>()
const mockSession = {
  withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
  endSession: jest.fn()
}

class MockUnrecoverableError extends Error {}

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({})),
  Worker: jest.fn(() => ({
    on: mockWorkerOn.mockImplementation(
      (event: string, handler: (...args: unknown[]) => unknown) => {
        workerEventHandlers.set(event, handler)
      }
    ),
    close: jest.fn()
  })),
  UnrecoverableError: MockUnrecoverableError
}))

jest.mock('mongoose', () => {
  class ObjectId {
    constructor(readonly value: string) {}
    toString() {
      return this.value
    }
    static isValid() {
      return true
    }
  }

  return {
    __esModule: true,
    default: {
      Types: { ObjectId },
      startSession: jest.fn(() => Promise.resolve(mockSession))
    }
  }
})

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
  invalidateUserAnalyticsCache: (...args: unknown[]) =>
    mockInvalidateAnalytics(...args)
}))

jest.mock('../../models/transaction.model', () => ({
  __esModule: true,
  default: {
    updateMany: jest.fn(),
    findOne: (...args: unknown[]) => ({
      session: (session: unknown) => mockTransactionFindOne(...args, session)
    }),
    create: (...args: unknown[]) => mockTransactionCreate(...args),
    updateOne: (...args: unknown[]) => mockTransactionUpdateOne(...args),
    exists: (...args: unknown[]) => mockTransactionExists(...args)
  },
  TransactionStatusEnum: {
    COMPLETED: 'COMPLETED'
  }
}))

jest.mock('../../container', () => ({
  container: {
    getImportBatchRepository: () => ({
      findById: (...args: unknown[]) => mockFindBatchById(...args),
      claimForProcessing: (...args: unknown[]) => mockClaimBatch(...args),
      updateStatus: (...args: unknown[]) => mockUpdateBatchStatus(...args),
      updateProgress: (...args: unknown[]) => mockUpdateBatchProgress(...args),
      removeTransactionsArray: (...args: unknown[]) =>
        mockRemoveTransactionsArray(...args)
    }),
    getTransactionRepository: () => ({
      bulkCreate: (...args: unknown[]) => mockBulkCreate(...args)
    })
  }
}))

jest.mock('../../utils/dates/index', () => ({
  calculateNextOccurrence: (...args: unknown[]) =>
    mockCalculateNextOccurrence(...args)
}))

import { processBulkImportJob } from '../../workers/transaction.worker'
import { processRecurringChildJob } from '../../workers/transaction.worker'

const createJob = () =>
  ({
    id: 'bulk-job-1',
    data: {
      userId: 'user-123',
      importBatchId: '507f1f77bcf86cd799439011'
    },
    updateProgress: jest.fn()
  }) as never

const createRecurringJob = () =>
  ({
    id: 'recurring-job-1',
    data: {
      userId: 'user-123',
      transactionIds: ['source-123']
    }
  }) as never

describe('transaction worker bulk import', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateBatchStatus.mockResolvedValue(undefined)
    mockClaimBatch.mockResolvedValue(undefined)
    mockUpdateBatchProgress.mockResolvedValue(undefined)
    mockRemoveTransactionsArray.mockResolvedValue(undefined)
    mockInvalidateAnalytics.mockResolvedValue(undefined)
    mockTransactionCreate.mockResolvedValue([])
    mockTransactionUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    mockTransactionExists.mockResolvedValue({ _id: 'occurrence-123' })
    mockCalculateNextOccurrence.mockReturnValue(
      new Date('2026-07-01T00:00:00.000Z')
    )
  })

  it('rejects a missing import batch as unrecoverable', async () => {
    mockFindBatchById.mockResolvedValue(null)

    await expect(processBulkImportJob(createJob())).rejects.toBeInstanceOf(
      MockUnrecoverableError
    )
    expect(mockBulkCreate).not.toHaveBeenCalled()
  })

  it('skips a replay when the import batch is already completed', async () => {
    mockFindBatchById.mockResolvedValue({
      status: 'COMPLETED'
    })

    await expect(processBulkImportJob(createJob())).resolves.toEqual({
      status: 'skipped',
      reason: 'import-batch-already-completed',
      details: {
        importBatchId: '507f1f77bcf86cd799439011'
      }
    })
    expect(mockBulkCreate).not.toHaveBeenCalled()
  })

  it('resumes from the durable checkpoint and persists chunk progress', async () => {
    const transactions = [
      { date: '2026-01-01', title: 'already processed' },
      { date: '2026-01-02', title: 'next row', status: 'COMPLETED' }
    ]
    mockFindBatchById.mockResolvedValue({
      status: 'PROCESSING',
      transactions,
      processedCount: 1,
      rejectedCount: 0
    })
    mockBulkCreate.mockResolvedValue({ insertedCount: 1 })

    await processBulkImportJob(createJob())

    expect(mockBulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'next row',
        importRowIndex: 1
      })
    ])
    expect(mockUpdateBatchProgress).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      2,
      0
    )
    expect(mockUpdateBatchStatus).toHaveBeenLastCalledWith(
      '507f1f77bcf86cd799439011',
      'COMPLETED',
      expect.any(Date)
    )
  })

  it('treats an already-upserted import row as processed after a crash', async () => {
    mockFindBatchById.mockResolvedValue({
      status: 'PROCESSING',
      transactions: [
        { date: '2026-01-02', title: 'already inserted before crash' }
      ],
      processedCount: 0,
      rejectedCount: 0
    })
    mockBulkCreate.mockResolvedValue({ insertedCount: 0 })

    await expect(processBulkImportJob(createJob())).resolves.toEqual({
      insertedCount: 1,
      rejectedCount: 0,
      success: true
    })
    expect(mockUpdateBatchProgress).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      1,
      0
    )
  })

  it('marks and notifies a bulk import failure only on the final attempt', async () => {
    const failedHandler = workerEventHandlers.get('failed')
    const job = Object.assign(createJob(), {
      name: 'bulk-import',
      attemptsMade: 3,
      opts: { attempts: 3 }
    })

    await failedHandler?.(job, new Error('Database unavailable'))

    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'FAILED',
      expect.any(Date)
    )
    expect(mockEmit).toHaveBeenCalledWith('bulk-import:failed', {
      message: 'Import failed, please try again'
    })
  })
})

describe('transaction worker recurring occurrences', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTransactionCreate.mockResolvedValue([])
    mockTransactionUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    mockTransactionExists.mockResolvedValue({ _id: 'occurrence-123' })
    mockCalculateNextOccurrence.mockReturnValue(
      new Date('2026-07-01T00:00:00.000Z')
    )
  })

  it('creates and advances one occurrence in the same session', async () => {
    const occurrenceDate = new Date('2026-06-01T00:00:00.000Z')
    mockTransactionFindOne
      .mockResolvedValueOnce({
        _id: 'source-123',
        userId: 'user-123',
        title: 'Rent',
        amount: 100,
        type: 'EXPENSE',
        category: 'Housing',
        date: occurrenceDate,
        nextRecurringDate: occurrenceDate,
        recurringInterval: 'MONTHLY',
        currency: 'USD',
        paymentMethod: 'BANK_TRANSFER',
        status: 'COMPLETED'
      })
      .mockResolvedValueOnce(null)

    await expect(
      processRecurringChildJob(createRecurringJob())
    ).resolves.toEqual({
      status: 'succeeded',
      details: { processedCount: 1, skippedCount: 0 }
    })

    expect(mockTransactionCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          recurringSourceId: 'source-123',
          date: occurrenceDate
        })
      ],
      { session: mockSession }
    )
    expect(mockTransactionUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'source-123',
        nextRecurringDate: occurrenceDate
      }),
      expect.any(Object),
      { session: mockSession }
    )
  })

  it('returns skipped when replay finds no due recurring source', async () => {
    mockTransactionFindOne.mockResolvedValueOnce(null)

    await expect(
      processRecurringChildJob(createRecurringJob())
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'recurring-occurrences-already-processed',
      details: { processedCount: 0, skippedCount: 1 }
    })
    expect(mockTransactionCreate).not.toHaveBeenCalled()
  })

  it('treats a concurrent duplicate occurrence as a verified no-op', async () => {
    const occurrenceDate = new Date('2026-06-01T00:00:00.000Z')
    mockTransactionFindOne
      .mockResolvedValueOnce({
        _id: 'source-123',
        userId: 'user-123',
        nextRecurringDate: occurrenceDate,
        recurringInterval: 'MONTHLY'
      })
      .mockResolvedValueOnce(null)
    mockTransactionCreate.mockRejectedValue(
      Object.assign(new Error('duplicate occurrence'), { code: 11000 })
    )

    await expect(
      processRecurringChildJob(createRecurringJob())
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'recurring-occurrences-already-processed',
      details: { processedCount: 0, skippedCount: 1 }
    })
    expect(mockTransactionExists).toHaveBeenCalledWith({
      recurringSourceId: 'source-123',
      date: occurrenceDate
    })
  })

  it('propagates a transaction failure without reporting success', async () => {
    const occurrenceDate = new Date('2026-06-01T00:00:00.000Z')
    mockTransactionFindOne
      .mockResolvedValueOnce({
        _id: 'source-123',
        userId: 'user-123',
        nextRecurringDate: occurrenceDate,
        recurringInterval: 'MONTHLY'
      })
      .mockResolvedValueOnce(null)
    mockTransactionUpdateOne.mockRejectedValue(
      new Error('Source advance failed')
    )

    await expect(
      processRecurringChildJob(createRecurringJob())
    ).rejects.toThrow('Source advance failed')
    expect(mockSession.withTransaction).toHaveBeenCalled()
    expect(mockSession.endSession).toHaveBeenCalled()
  })
})

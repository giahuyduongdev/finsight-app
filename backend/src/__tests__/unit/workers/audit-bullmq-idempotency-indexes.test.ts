const mockAggregate = jest.fn()
const mockTransactionCreateIndexes = jest.fn()
const mockReportCreateIndexes = jest.fn()

jest.mock('../../../models/transaction.model', () => ({
  __esModule: true,
  default: {
    aggregate: (...args: unknown[]) => mockAggregate(...args),
    createIndexes: (...args: unknown[]) => mockTransactionCreateIndexes(...args)
  }
}))

jest.mock('../../../models/report.model', () => ({
  __esModule: true,
  default: {
    createIndexes: (...args: unknown[]) => mockReportCreateIndexes(...args)
  }
}))

jest.mock('../../../config/logger.config', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}))

import { auditBullMQIdempotencyIndexes } from '../../../scripts/audit-bullmq-idempotency-indexes'

describe('BullMQ idempotency index audit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTransactionCreateIndexes.mockResolvedValue(undefined)
    mockReportCreateIndexes.mockResolvedValue(undefined)
  })

  it('fails safely instead of creating indexes over duplicate occurrences', async () => {
    mockAggregate.mockResolvedValue([
      {
        _id: {
          recurringSourceId: { toString: () => 'source-123' },
          date: new Date('2026-06-01T00:00:00.000Z')
        },
        count: 2
      }
    ])

    await expect(auditBullMQIdempotencyIndexes()).rejects.toThrow(
      'Duplicate recurring occurrences require manual resolution'
    )
    expect(mockTransactionCreateIndexes).not.toHaveBeenCalled()
    expect(mockReportCreateIndexes).not.toHaveBeenCalled()
  })

  it('creates idempotency indexes after a clean audit', async () => {
    mockAggregate.mockResolvedValue([])

    await auditBullMQIdempotencyIndexes()

    expect(mockTransactionCreateIndexes).toHaveBeenCalled()
    expect(mockReportCreateIndexes).toHaveBeenCalled()
  })
})

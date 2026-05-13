import { ITransactionRepository } from './interfaces/transaction-repository.interface'
import TransactionModel, {
  TransactionDocument
} from '../models/transaction.model'
import {
  PaginationParams,
  PaginatedResult,
  TransactionFilters,
  DeleteResult,
  BulkInsertResult
} from '../types/repository.type'
import { getDateRange } from '../utils/dates/index'
import { invalidateUserAnalyticsCache } from '../utils/cache.util'

/**
 * Transaction Repository Implementation
 * Handles all transaction data access operations
 */
export class TransactionRepository implements ITransactionRepository {
  /**
   * Create single transaction
   * Invalidates user analytics cache
   */
  async create(
    transactionData: Partial<TransactionDocument>
  ): Promise<TransactionDocument> {
    const transaction = await TransactionModel.create(transactionData)

    // Invalidate analytics cache
    if (transactionData.userId) {
      await invalidateUserAnalyticsCache(transactionData.userId.toString())
    }

    return transaction
  }

  /**
   * Bulk create transactions
   * Invalidates analytics cache for all affected users
   */
  async bulkCreate(
    transactions: Partial<TransactionDocument>[]
  ): Promise<BulkInsertResult> {
    const bulkOps = transactions.map((tx) => ({ insertOne: { document: tx } }))
    const result = await TransactionModel.bulkWrite(bulkOps, { ordered: true })

    // Invalidate cache for all affected users
    const userIds = [
      ...new Set(
        transactions
          .map((t) => t.userId?.toString())
          .filter(Boolean) as string[]
      )
    ]
    await Promise.all(
      userIds.map((userId) => invalidateUserAnalyticsCache(userId))
    )

    return { insertedCount: result.insertedCount }
  }

  /**
   * Find transaction by ID and user ID
   */
  async findById(
    transactionId: string,
    userId: string
  ): Promise<TransactionDocument | null> {
    return await TransactionModel.findOne({
      _id: transactionId,
      userId
    })
  }

  /**
   * Find transactions by user ID with filters and pagination
   */
  async findByUserId(
    userId: string,
    filters: TransactionFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<TransactionDocument>> {
    const filterConditions = this.buildFilterConditions(userId, filters)
    const { pageSize, pageNumber } = pagination
    const skip = (pageNumber - 1) * pageSize

    const [transactions, totalCount] = await Promise.all([
      TransactionModel.find(filterConditions)
        .skip(skip)
        .limit(pageSize)
        .sort({ date: -1, createdAt: -1 }),
      TransactionModel.countDocuments(filterConditions)
    ])

    return {
      data: transactions,
      pagination: {
        pageSize,
        pageNumber,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        skip
      }
    }
  }

  /**
   * Find child transactions by parent ID
   */
  async findChildTransactions(
    parentId: string,
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<TransactionDocument>> {
    const { pageSize, pageNumber } = pagination
    const skip = (pageNumber - 1) * pageSize

    const filterConditions = {
      userId,
      recurringSourceId: parentId
    }

    const [transactions, totalCount] = await Promise.all([
      TransactionModel.find(filterConditions)
        .skip(skip)
        .limit(pageSize)
        .sort({ date: -1, createdAt: -1 }),
      TransactionModel.countDocuments(filterConditions)
    ])

    return {
      data: transactions,
      pagination: {
        pageSize,
        pageNumber,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        skip
      }
    }
  }

  /**
   * Find recurring transactions due for processing
   */
  async findRecurringDue(currentDate: Date): Promise<TransactionDocument[]> {
    return await TransactionModel.find({
      isRecurring: true,
      nextRecurringDate: { $lte: currentDate }
    })
  }

  /**
   * Update transaction
   * Invalidates user analytics cache
   */
  async update(
    transactionId: string,
    userId: string,
    updates: Partial<TransactionDocument>
  ): Promise<TransactionDocument | null> {
    const transaction = await TransactionModel.findOneAndUpdate(
      { _id: transactionId, userId },
      updates,
      { new: true }
    )

    // Invalidate analytics cache
    if (transaction) {
      await invalidateUserAnalyticsCache(userId)
    }

    return transaction
  }

  /**
   * Delete transaction by ID
   * Invalidates user analytics cache
   */
  async deleteById(transactionId: string, userId: string): Promise<boolean> {
    const result = await TransactionModel.deleteOne({
      _id: transactionId,
      userId
    })

    // Invalidate analytics cache
    if (result.deletedCount > 0) {
      await invalidateUserAnalyticsCache(userId)
    }

    return result.deletedCount > 0
  }

  /**
   * Bulk delete transactions by IDs
   * Invalidates user analytics cache
   */
  async bulkDelete(
    transactionIds: string[],
    userId: string
  ): Promise<DeleteResult> {
    const result = await TransactionModel.deleteMany({
      _id: { $in: transactionIds },
      userId
    })

    // Invalidate analytics cache
    if (result.deletedCount > 0) {
      await invalidateUserAnalyticsCache(userId)
    }

    return { deletedCount: result.deletedCount }
  }

  /**
   * Delete child transactions by parent ID
   * Invalidates user analytics cache
   */
  async deleteChildrenByParentId(
    parentId: string,
    userId: string
  ): Promise<DeleteResult> {
    const result = await TransactionModel.deleteMany({
      recurringSourceId: parentId,
      userId
    })

    // Invalidate analytics cache
    if (result.deletedCount > 0) {
      await invalidateUserAnalyticsCache(userId)
    }

    return { deletedCount: result.deletedCount }
  }

  /**
   * Count transactions matching filter criteria
   */
  async countByFilters(
    userId: string,
    filters: TransactionFilters
  ): Promise<number> {
    const filterConditions = this.buildFilterConditions(userId, filters)
    return await TransactionModel.countDocuments(filterConditions)
  }

  /**
   * Execute aggregation pipeline
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async aggregate(pipeline: any[]): Promise<any[]> {
    return await TransactionModel.aggregate(pipeline)
  }

  /**
   * Build filter conditions for transaction queries
   * Private helper method
   */
  private buildFilterConditions(
    userId: string,
    filters: TransactionFilters
  ): Record<string, unknown> {
    const conditions: Record<string, unknown> = {
      userId,
      $or: [
        { recurringSourceId: null },
        { recurringSourceId: { $exists: false } }
      ]
    }

    // Date range filtering with timezone support
    if (filters.dateRangePreset || filters.from || filters.to) {
      const dateRange = getDateRange(
        filters.dateRangePreset as
          | '30days'
          | 'lastMonth'
          | 'last3Months'
          | 'lastYear'
          | 'thisMonth'
          | 'thisYear'
          | 'allTime'
          | 'custom'
          | undefined,
        filters.from ? new Date(filters.from) : undefined,
        filters.to ? new Date(filters.to) : undefined,
        filters.timezone || 'UTC'
      )

      if (dateRange.from || dateRange.to) {
        conditions.date = {} as { $gte?: Date; $lte?: Date }
        if (dateRange.from)
          (conditions.date as { $gte?: Date; $lte?: Date }).$gte =
            dateRange.from
        if (dateRange.to)
          (conditions.date as { $gte?: Date; $lte?: Date }).$lte = dateRange.to
      }
    }

    // Keyword search on title and category
    if (filters.keyword) {
      conditions.$or = [
        { title: { $regex: filters.keyword, $options: 'i' } },
        { category: { $regex: filters.keyword, $options: 'i' } }
      ]
    }

    // Simple filters
    if (filters.type) conditions.type = filters.type
    if (filters.currency) conditions.currency = filters.currency
    if (filters.status) conditions.status = filters.status

    // Recurring status filter
    if (filters.recurringStatus === 'RECURRING') {
      conditions.isRecurring = true
    } else if (filters.recurringStatus === 'NON_RECURRING') {
      conditions.isRecurring = false
    }

    return conditions
  }
}

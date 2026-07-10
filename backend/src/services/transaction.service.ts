import { TransactionTypeEnum } from '../models/transaction.model'
import { calculateNextOccurrence } from '../utils/dates/index'
import {
  CreateTransactionType,
  UpdateTransactionType
} from '../validators/transaction.validator'
import { NotFoundException } from '../utils/errors/index'
import { CurrencyType } from '../enums/currency.enum'
import { DateRangePreset } from '../enums/date-range.enum'
import { invalidateUserAnalyticsCache } from '../utils/cache.util'
import { ITransactionRepository } from '../repositories/interfaces/transaction-repository.interface'
import { IImportBatchRepository } from '../repositories/interfaces/import-batch-repository.interface'
import mongoose from 'mongoose'
import { BulkTransactionItem } from '../types/transaction.type'

// ─── TransactionService Class (New - DI-based) ───────────────────────────────

/**
 * TransactionService Class
 * Handles transaction-related business logic with dependency injection
 */
export class TransactionService {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly importBatchRepository: IImportBatchRepository
  ) {}

  /**
   * Create a new transaction
   * @param body - Transaction data
   * @param userId - User ID
   * @returns Created transaction
   */
  async create(body: CreateTransactionType, userId: string) {
    let nextRecurringDate: Date | undefined
    const currentDate = new Date()

    if (body.isRecurring && body.recurringInterval) {
      const calculatedDate = calculateNextOccurrence(
        body.date,
        body.recurringInterval
      )
      nextRecurringDate =
        calculatedDate < currentDate
          ? calculateNextOccurrence(currentDate, body.recurringInterval)
          : calculatedDate
    }

    const transaction = await this.transactionRepository.create({
      ...body,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId: new mongoose.Types.ObjectId(userId) as any,
      status: body.status || 'COMPLETED',
      category: body.category,
      amount: Number(body.amount),
      currency: body.currency || 'USD',
      isRecurring: body.isRecurring,
      recurringInterval: body.recurringInterval || undefined,
      nextRecurringDate,
      lastProcessed: undefined
    })

    // --- BACKFILL ---
    if (
      body.backfill &&
      body.isRecurring &&
      body.recurringInterval &&
      body.date < currentDate
    ) {
      const MAX_BACKFILL_ENTRIES = 1000
      const children: Array<
        Partial<CreateTransactionType> & {
          userId: string
          recurringSourceId: unknown
        }
      > = []
      let cursor = new Date(body.date)
      let count = 0

      while (cursor <= currentDate && count < MAX_BACKFILL_ENTRIES) {
        children.push({
          ...body,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          userId: new mongoose.Types.ObjectId(userId) as any,
          date: new Date(cursor),
          isRecurring: false,
          recurringInterval: undefined,
          recurringSourceId: transaction._id,
          status: 'COMPLETED'
        })
        cursor = calculateNextOccurrence(cursor, body.recurringInterval)
        count++
      }

      if (children.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.transactionRepository.bulkCreate(children as any[])
      }

      // cursor sau vòng while = kỳ đầu tiên sau now
      // Update lại parent để tránh cron tạo trùng
      await this.transactionRepository.update(
        transaction._id.toString(),
        userId,
        {
          nextRecurringDate: cursor
        }
      )
    }
    // --- END BACKFILL ---

    // Invalidate analytics cache
    await invalidateUserAnalyticsCache(userId)

    return transaction
  }

  /**
   * Find transactions by user ID with filters and pagination
   * @param userId - User ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated transactions
   */
  async findByUserId(
    userId: string,
    filters: {
      keyword?: string
      type?: keyof typeof TransactionTypeEnum
      recurringStatus?: 'RECURRING' | 'NON_RECURRING'
      currency?: CurrencyType
      status?: 'COMPLETED' | 'PENDING' | 'FAILED'
      dateRangePreset?: DateRangePreset
      from?: string | Date
      to?: string | Date
      timezone?: string
      importBatchId?: string
    },
    pagination: {
      pageSize: number
      pageNumber: number
    }
  ) {
    return await this.transactionRepository.findByUserId(
      userId,
      filters,
      pagination
    )
  }

  /**
   * Find transaction by ID
   * @param userId - User ID
   * @param transactionId - Transaction ID
   * @returns Transaction document
   * @throws NotFoundException if transaction not found
   */
  async findById(userId: string, transactionId: string) {
    const transaction = await this.transactionRepository.findById(
      transactionId,
      userId
    )

    if (!transaction) throw new NotFoundException('Transaction not found')

    return transaction
  }

  /**
   * Find child transactions of a recurring parent
   * @param userId - User ID
   * @param parentId - Parent transaction ID
   * @param pageNumber - Page number
   * @param pageSize - Page size
   * @returns Paginated child transactions
   * @throws NotFoundException if parent transaction not found
   */
  async findChildTransactions(
    userId: string,
    parentId: string,
    pageNumber: number = 1,
    pageSize: number = 10
  ) {
    return await this.transactionRepository.findChildTransactions(
      userId,
      parentId,
      { pageNumber, pageSize }
    )
  }

  /**
   * Duplicate a transaction
   * @param userId - User ID
   * @param transactionId - Transaction ID to duplicate
   * @returns Duplicated transaction
   * @throws NotFoundException if transaction not found
   */
  async duplicate(userId: string, transactionId: string) {
    const transaction = await this.transactionRepository.findById(
      transactionId,
      userId
    )
    if (!transaction) throw new NotFoundException('Transaction not found')

    const duplicated = await this.transactionRepository.create({
      ...transaction.toObject(),
      _id: undefined,
      title: `Duplicate - ${transaction.title}`,
      description: transaction.description
        ? `${transaction.description} (Duplicate)`
        : 'Duplicated transaction',

      // --- RESET CÁC THÔNG SỐ ĐỊNH KỲ ---
      isRecurring: false,
      recurringInterval: undefined,
      nextRecurringDate: undefined,

      // --- NHỮNG TRƯỜNG MỚI CẦN UPDATE ---
      status: 'COMPLETED',
      recurringSourceId: null,

      createdAt: undefined,
      updatedAt: undefined
    })

    await invalidateUserAnalyticsCache(userId)

    return duplicated
  }

  /**
   * Update a transaction
   * @param userId - User ID
   * @param transactionId - Transaction ID
   * @param body - Update data
   * @returns Updated transaction
   * @throws NotFoundException if transaction not found
   */
  async update(
    userId: string,
    transactionId: string,
    body: UpdateTransactionType
  ) {
    const existingTransaction = await this.transactionRepository.findById(
      transactionId,
      userId
    )
    if (!existingTransaction)
      throw new NotFoundException('Transaction not found')

    const now = new Date()
    const isRecurring = body.isRecurring ?? existingTransaction.isRecurring

    const date =
      body.date !== undefined ? new Date(body.date) : existingTransaction.date

    const recurringInterval =
      body.recurringInterval || existingTransaction.recurringInterval

    let nextRecurringDate: Date | undefined

    if (isRecurring && recurringInterval) {
      const calculatedDate = calculateNextOccurrence(date, recurringInterval)

      nextRecurringDate =
        calculatedDate < now
          ? calculateNextOccurrence(now, recurringInterval)
          : calculatedDate
    }

    // Kiểm tra sự thay đổi schedule TRƯỚC KHI set data mới
    const isScheduleChanged =
      (body.date !== undefined &&
        new Date(body.date).getTime() !== existingTransaction.date.getTime()) ||
      (body.recurringInterval !== undefined &&
        body.recurringInterval !== existingTransaction.recurringInterval)

    const updateData: Partial<typeof existingTransaction> = {
      ...(body.title && { title: body.title }),
      ...(body.description && { description: body.description }),
      ...(body.category && { category: body.category }),
      ...(body.type && { type: body.type }),
      ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
      ...(body.amount !== undefined && { amount: Number(body.amount) }),
      ...(body.currency && { currency: body.currency }),
      ...(body.status && { status: body.status }),
      date,
      isRecurring,
      recurringInterval,
      nextRecurringDate
    }

    const updatedTransaction = await this.transactionRepository.update(
      transactionId,
      userId,
      updateData
    )

    if (!updatedTransaction)
      throw new NotFoundException('Transaction not found')

    if (updatedTransaction.isRecurring && isScheduleChanged) {
      // Xóa tất cả PENDING children → cron sẽ tạo lại theo schedule mới
      await this.transactionRepository.deleteChildrenByParentId(
        transactionId,
        userId
      )
    }

    // Invalidate analytics cache
    await invalidateUserAnalyticsCache(userId)

    return updatedTransaction
  }

  /**
   * Delete a transaction by ID
   * @param userId - User ID
   * @param transactionId - Transaction ID
   * @throws NotFoundException if transaction not found
   */
  async deleteById(userId: string, transactionId: string) {
    const deleted = await this.transactionRepository.deleteById(
      transactionId,
      userId
    )
    if (!deleted) throw new NotFoundException('Transaction not found')

    // Xóa luôn các giao dịch con (nếu đây là giao dịch cha)
    await this.transactionRepository.deleteChildrenByParentId(
      transactionId,
      userId
    )

    // Invalidate analytics cache
    await invalidateUserAnalyticsCache(userId)
  }

  /**
   * Bulk delete transactions
   * @param userId - User ID
   * @param transactionIds - Array of transaction IDs
   * @returns Delete result
   * @throws NotFoundException if no transactions found
   */
  async bulkDelete(userId: string, transactionIds: string[]) {
    const result = await this.transactionRepository.bulkDelete(
      transactionIds,
      userId
    )

    if (result.deletedCount === 0)
      throw new NotFoundException('No transactions found')

    // Xóa luôn các giao dịch con thuộc các giao dịch cha này
    for (const id of transactionIds) {
      await this.transactionRepository.deleteChildrenByParentId(id, userId)
    }

    // Invalidate analytics cache
    await invalidateUserAnalyticsCache(userId)

    return {
      success: true,
      deletedCount: result.deletedCount
    }
  }

  /**
   * Bulk import transactions
   * @param userId - User ID
   * @param transactions - Array of transactions to import
   * @returns Import result
   */
  async bulkImport(userId: string, transactions: BulkTransactionItem[]) {
    const transactionsToCreate = transactions.map((tx) => ({
      ...tx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId: new mongoose.Types.ObjectId(userId) as any,
      isRecurring: false,
      nextRecurringDate: undefined,
      recurringInterval: undefined,
      lastProcessed: undefined
    }))

    const result =
      await this.transactionRepository.bulkCreate(transactionsToCreate)

    // Invalidate analytics cache
    await invalidateUserAnalyticsCache(userId)

    return {
      insertedCount: result.insertedCount,
      success: true
    }
  }
}

import TransactionModel, {
  TransactionTypeEnum
} from '../models/transaction.model'
import { calculateNextOccurrence, getDateRange } from '../utils/dates/index'
import {
  CreateTransactionType,
  UpdateTransactionType
} from '../validators/transaction.validator'
import { NotFoundException } from '../utils/errors/index'
import { redis } from '../config/redis.config'
import { CurrencyType } from '../enums/currency.enum'
import { DateRangePreset } from '../enums/date-range.enum'
import { logger } from '../config/logger.config'
import { invalidateUserAnalyticsCache } from '../utils/cache.util'


export const createTransactionService = async (
  body: CreateTransactionType,
  userId: string
) => {
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

  const transaction = await TransactionModel.create({
    ...body,
    userId,
    status: body.status || 'COMPLETED',
    category: body.category,
    amount: Number(body.amount),
    currency: body.currency || 'USD',
    isRecurring: body.isRecurring,
    recurringInterval: body.recurringInterval || null,
    nextRecurringDate,
    lastProcessed: null
  })

  // --- BACKFILL ---
  if (
    body.backfill &&
    body.isRecurring &&
    body.recurringInterval &&
    body.date < currentDate
  ) {
    const children: any[] = []
    let cursor = new Date(body.date)

    while (cursor <= currentDate) {
      children.push({
        ...body,
        userId,
        date: new Date(cursor),
        isRecurring: false,
        recurringInterval: null,
        nextRecurringDate: null,
        lastProcessed: null,
        recurringSourceId: transaction._id,
        status: 'COMPLETED'
      })
      cursor = calculateNextOccurrence(cursor, body.recurringInterval)
    }

    if (children.length) await TransactionModel.insertMany(children)

    // cursor sau vòng while = kỳ đầu tiên sau now
    // Update lại parent để tránh cron tạo trùng
    await TransactionModel.updateOne(
      { _id: transaction._id },
      { $set: { nextRecurringDate: cursor } }
    )
  }
  // --- END BACKFILL ---

  // Invalidate analytics cache
  await invalidateUserAnalyticsCache(userId)

  return transaction
}

export const getAllTransactionService = async (
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
  },
  pagination: {
    pageSize: number
    pageNumber: number
  }
) => {
  const {
    keyword,
    type,
    recurringStatus,
    currency,
    status,
    dateRangePreset,
    from,
    to,
    timezone
  } = filters

  const filterConditions: Record<string, any> = {
    userId,
    recurringSourceId: null
  }

  // --- Date Range Filter ---
  const dateRange = getDateRange(
    dateRangePreset,
    from ? new Date(from) : undefined,
    to ? new Date(to) : undefined,
    timezone || 'UTC'
  )

  if (dateRange.from || dateRange.to) {
    filterConditions.date = {}
    if (dateRange.from) filterConditions.date.$gte = dateRange.from
    if (dateRange.to) filterConditions.date.$lte = dateRange.to
  }

  if (keyword) {
    filterConditions.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { category: { $regex: keyword, $options: 'i' } }
    ]
  }

  if (type) {
    filterConditions.type = type
  }

  if (currency) {
    filterConditions.currency = currency
  }

  if (status) {
    filterConditions.status = status
  }

  if (recurringStatus) {
    if (recurringStatus === 'RECURRING') {
      filterConditions.isRecurring = true
    } else if (recurringStatus === 'NON_RECURRING') {
      filterConditions.isRecurring = false
    }
  }

  const { pageSize, pageNumber } = pagination
  const skip = (pageNumber - 1) * pageSize

  const [transactions, totalCount] = await Promise.all([
    TransactionModel.find(filterConditions)
      .skip(skip)
      .limit(pageSize)
      .sort({ date: -1, createdAt: -1 }),
    TransactionModel.countDocuments(filterConditions)
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    transactions,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip
    }
  }
}

export const getTransactionByIdService = async (
  userId: string,
  transactionId: string
) => {
  const transaction = await TransactionModel.findOne({
    _id: transactionId,
    userId
  })

  if (!transaction) throw new NotFoundException('Transaction not found')

  return transaction
}

export const getChildTransactionsService = async (
  userId: string,
  parentId: string,
  pageNumber: number = 1,
  pageSize: number = 10
) => {
  const parent = await TransactionModel.findOne({
    _id: parentId,
    userId,
    isRecurring: true
  })

  if (!parent) throw new NotFoundException('Transaction not found')

  const query = {
    recurringSourceId: parentId,
    userId
  }

  const [children, totalCount] = await Promise.all([
    TransactionModel.find(query)
      .sort({ date: -1 }) // mới nhất lên đầu
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize),
    TransactionModel.countDocuments(query)
  ])

  return {
    children,
    pagination: {
      totalCount,
      pageSize,
      pageNumber,
      totalPages: Math.ceil(totalCount / pageSize)
    }
  }
}

export const duplicateTransactionService = async (
  userId: string,
  transactionId: string
) => {
  const transaction = await TransactionModel.findOne({
    _id: transactionId,
    userId
  })
  if (!transaction) throw new NotFoundException('Transaction not found')

  const duplicated = await TransactionModel.create({
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
    status: 'COMPLETED', // Reset về trạng thái an toàn mặc định
    recurringSourceId: null, // Cắt đứt quan hệ họ hàng với giao dịch gốc

    createdAt: undefined,
    updatedAt: undefined
  })

  await invalidateUserAnalyticsCache(userId)

  return duplicated
}

export const updateTransactionService = async (
  userId: string,
  transactionId: string,
  body: UpdateTransactionType
) => {
  const existingTransaction = await TransactionModel.findOne({
    _id: transactionId,
    userId
  })
  if (!existingTransaction) throw new NotFoundException('Transaction not found')

  const now = new Date()
  const isRecurring = body.isRecurring ?? existingTransaction.isRecurring

  const date =
    body.date !== undefined ? new Date(body.date) : existingTransaction.date

  const recurringInterval =
    body.recurringInterval || existingTransaction.recurringInterval

  let nextRecurringDate: Date | undefined

  if (isRecurring && recurringInterval) {
    const calulatedDate = calculateNextOccurrence(date, recurringInterval)

    nextRecurringDate =
      calulatedDate < now
        ? calculateNextOccurrence(now, recurringInterval)
        : calulatedDate
  }

  // Kiểm tra sự thay đổi schedule TRƯỚC KHI set data mới
  const isScheduleChanged =
    (body.date !== undefined &&
      new Date(body.date).getTime() !== existingTransaction.date.getTime()) ||
    (body.recurringInterval !== undefined &&
      body.recurringInterval !== existingTransaction.recurringInterval)

  existingTransaction.set({
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
  })

  await existingTransaction.save()

  if (existingTransaction.isRecurring && isScheduleChanged) {
    // Xóa tất cả PENDING children → cron sẽ tạo lại theo schedule mới
    await TransactionModel.deleteMany({
      recurringSourceId: existingTransaction._id,
      status: 'PENDING'
    })
  }

  // Invalidate analytics cache
  await invalidateUserAnalyticsCache(userId)

  return existingTransaction
}

export const deleteTransactionService = async (
  userId: string,
  transactionId: string
) => {
  const deleted = await TransactionModel.findOneAndDelete({
    _id: transactionId,
    userId
  })
  if (!deleted) throw new NotFoundException('Transaction not found')

  // Xóa luôn các giao dịch con (nếu đây là giao dịch cha)
  await TransactionModel.deleteMany({
    recurringSourceId: transactionId,
    userId
  })

  // Invalidate analytics cache
  await invalidateUserAnalyticsCache(userId)

  return
}

export const bulkDeleteTransactionService = async (
  userId: string,
  transactionIds: string[]
) => {
  const result = await TransactionModel.deleteMany({
    _id: { $in: transactionIds },
    userId
  })

  if (result.deletedCount === 0)
    throw new NotFoundException('No transations found')

  // Xóa luôn các giao dịch con thuộc các giao dịch cha này
  await TransactionModel.deleteMany({
    recurringSourceId: { $in: transactionIds },
    userId
  })

  // Invalidate analytics cache
  await invalidateUserAnalyticsCache(userId)

  return {
    sucess: true,
    deletedCount: result.deletedCount
  }
}

export type BulkTransactionItem = Omit<
  CreateTransactionType,
  'status' | 'backfill'
> & {
  status: 'COMPLETED' | 'PENDING' | 'FAILED'
  backfill?: boolean // Thêm dấu ? để biến nó thành optional (không bắt buộc)
}
export const bulkImportTransactionService = async (
  userId: string,
  transactions: BulkTransactionItem[]
) => {
  const bulkOps = transactions.map((tx) => ({
    insertOne: {
      document: {
        ...tx,
        userId,
        isRecurring: false,
        nextRecurringDate: null,
        recurringInterval: null,
        lastProcessed: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  }))

  const result = await TransactionModel.bulkWrite(bulkOps, {
    ordered: true
  })

  // Invalidate analytics cache
  await invalidateUserAnalyticsCache(userId)

  return {
    insertedCount: result.insertedCount,
    success: true
  }
}


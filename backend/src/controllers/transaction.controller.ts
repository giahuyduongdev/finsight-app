import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import {
  bulkDeleteTransactionSchema,
  bulkTransactionSchema,
  createTransactionSchema,
  transactionIdSchema,
  updateTransactionSchema
} from '../validators/transaction.validator'
import {
  bulkDeleteTransactionService,
  createTransactionService,
  deleteTransactionService,
  duplicateTransactionService,
  getAllTransactionService,
  getChildTransactionsService,
  getTransactionByIdService,
  updateTransactionService
} from '../services/transaction.service'
import { TransactionTypeEnum } from '../models/transaction.model'
import { CurrencyType } from '../enums/currency.enum'
import { transactionQueue, receiptQueue } from '../queues'
import { TRANSACTION_JOBS } from '../queues/transaction.queue'
import { RECEIPT_JOBS } from '../queues/receipt.queue'
import importBatchModel from '../models/import-batch.model'
import { getIO } from '../config/socket.config'
import { getUserId } from '../utils/getUserId.util'

export const createTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createTransactionSchema.parse(req.body)
    const userId = getUserId(req)

    const transaction = await createTransactionService(body, userId)

    const io = getIO()
    io.to(userId).emit('transaction:created', transaction)

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Transaction created successfully',
      transaction
    })
  }
)

export const getAllTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)

    const filters = {
      keyword: req.query.keyword as string | undefined,
      type: req.query.type as keyof typeof TransactionTypeEnum | undefined,
      recurringStatus: req.query.recurringStatus as
        | 'RECURRING'
        | 'NON_RECURRING'
        | undefined,
      currency: req.query.currency as CurrencyType | undefined,
      status: req.query.status as
        | 'COMPLETED'
        | 'PENDING'
        | 'FAILED'
        | undefined,
      dateRangePreset: req.query.dateRangePreset as
        | '30days'
        | 'lastMonth'
        | 'last3Months'
        | 'lastYear'
        | 'thisMonth'
        | 'thisYear'
        | 'allTime'
        | 'custom'
        | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      timezone: req.query.timezone as string | undefined
    }

    const pagination = {
      pageSize: parseInt(req.query.pageSize as string) || 20,
      pageNumber: parseInt(req.query.pageNumber as string) || 1
    }

    const result = await getAllTransactionService(userId, filters, pagination)
    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction fetched successfully',
      ...(result as object)
    })
  }
)

export const getTransactionByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const transactionId = transactionIdSchema.parse(req.params.id)

    const transaction = await getTransactionByIdService(userId, transactionId)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction fetched successfully',
      transaction
    })
  }
)

export const getChildTransactionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const parentId = transactionIdSchema.parse(req.params.id)

    const pageNumber = Math.max(
      1,
      parseInt(req.query.pageNumber as string) || 1
    )
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(req.query.pageSize as string) || 10)
    )

    const result = await getChildTransactionsService(
      userId,
      parentId,
      pageNumber,
      pageSize
    )

    return res.status(HTTPSTATUS.OK).json({
      message: 'Child transactions fetched successfully',
      children: result.children,
      pagination: result.pagination
    })
  }
)

export const duplicateTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const transactionId = transactionIdSchema.parse(req.params.id)

    const transaction = await duplicateTransactionService(userId, transactionId)

    const io = getIO()
    io.to(userId).emit('transaction:created', transaction)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction fetched successfully',
      data: transaction
    })
  }
)

export const updateTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const transactionId = transactionIdSchema.parse(req.params.id)
    const body = updateTransactionSchema.parse(req.body)

    const updatedTransaction = await updateTransactionService(
      userId,
      transactionId,
      body
    )

    const io = getIO()
    io.to(userId).emit('transaction:updated', updatedTransaction)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction updated successfully',
      data: updatedTransaction
    })
  }
)

export const deleteTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const transactionId = transactionIdSchema.parse(req.params.id)

    await deleteTransactionService(userId, transactionId)

    const io = getIO()
    io.to(userId).emit('transaction:deleted', { _id: transactionId })

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction deleted successfully'
    })
  }
)

export const bulkDeleteTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const { transactionIds } = bulkDeleteTransactionSchema.parse(req.body)

    const result = await bulkDeleteTransactionService(userId, transactionIds)

    const io = getIO()
    io.to(userId).emit('transaction:bulk-deleted', { ids: transactionIds })

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction deleted successfully',
      ...result
    })
  }
)

export const bulkTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const { transactions } = bulkTransactionSchema.parse(req.body)

    // 1. TẠO "VÉ GIỮ ĐỒ": Lưu toàn bộ 300 giao dịch vào MongoDB trước
    const batch = await importBatchModel.create({
      userId,
      transactions,
      totalItems: transactions.length,
      status: 'PENDING'
    })

    // 2. GỌI WORKER: Chỉ nhét ID (Vé) vào Queue thay vì nhét cả mảng data
    const job = await transactionQueue.add(
      TRANSACTION_JOBS.BULK_IMPORT,
      {
        userId,
        importBatchId: batch._id.toString() // Truyền mỗi ID siêu nhẹ này thôi!
      },
      {
        // Đổi tên jobId gắn với batch._id để sau này dễ dàng dò lỗi (Traceability)
        jobId: `bulk-import-${userId}-${batch._id}`
      }
    )

    // 3. TRẢ KẾT QUẢ CHO FE
    return res.status(HTTPSTATUS.OK).json({
      message: 'Bulk import is being processed',
      batchId: batch._id, // Trả cái này về để FE có thể làm chức năng "Kiểm tra tiến độ"
      jobId: job.id
    })
  }
)

export const scanReceiptController = asyncHandler(
  async (req: Request, res: Response) => {
    const file = req?.file
    const userId = getUserId(req)

    if (!file) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: 'No file uploaded'
      })
    }

    // 🟠 Nitpick: Add file validation
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: 'Invalid file type. Allowed: JPEG, PNG, WebP'
      })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: 'File too large. Maximum size: 10MB'
      })
    }

    const job = await receiptQueue.add(RECEIPT_JOBS.SCAN_RECEIPT, {
      userId,
      fileBuffer: file.buffer.toString('base64'),
      fileName: file.originalname,
      fileSize: file.size
    })

    return res.status(HTTPSTATUS.ACCEPTED).json({
      message: 'Receipt is being processed',
      jobId: job.id?.toString() || 'unknown'
    })
  }
)

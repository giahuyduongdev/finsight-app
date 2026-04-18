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
  bulkTransactionService,
  createTransactionService,
  deleteTransactionService,
  duplicateTransactionService,
  getAllTransactionService,
  getChildTransactionsService,
  getTransactionByIdService,
  scanReceiptService,
  updateTransactionService
} from '../services/transaction.service'
import { TransactionTypeEnum } from '../models/transaction.model'
import { CurrencyType } from '../enums/currency.enum'
import { transactionQueue } from '../queues'
import { TRANSACTION_JOBS } from '../queues/transaction.queue'
import importBatchModel from '../models/import-batch.model'

export const createTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createTransactionSchema.parse(req.body)
    const userId = req.user?._id

    const transaction = await createTransactionService(body, userId)

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Transaction created successfully',
      transaction
    })
  }
)

export const getAllTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id

    const filters = {
      keyword: req.query.keyword as string | undefined,
      type: req.query.type as keyof typeof TransactionTypeEnum | undefined,
      recurringStatus: req.query.recurringStatus as
        | 'RECURRING'
        | 'NON_RECURRING'
        | undefined,
      currency: req.query.currency as CurrencyType | undefined,
      status: req.query.status as 'COMPLETED' | 'PENDING' | 'FAILED' | undefined
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

export const getAllTransactionByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
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
    const userId = req.user?._id
    const parentId = transactionIdSchema.parse(req.params.id)

    const children = await getChildTransactionsService(userId, parentId)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Child transactions fetched successfully',
      children
    })
  }
)

export const duplicateTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
    const transactionId = transactionIdSchema.parse(req.params.id)

    const transaction = await duplicateTransactionService(userId, transactionId)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction fetched successfully',
      data: transaction
    })
  }
)

export const updateTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
    const transactionId = transactionIdSchema.parse(req.params.id)
    const body = updateTransactionSchema.parse(req.body)

    const updatedTransaction = await updateTransactionService(
      userId,
      transactionId,
      body
    )

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction updated successfully',
      data: updatedTransaction
    })
  }
)

export const deleteTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
    const transactionId = transactionIdSchema.parse(req.params.id)

    await deleteTransactionService(userId, transactionId)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction deleted successfully'
    })
  }
)

export const bulkDeleteTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
    const { transactionIds } = bulkDeleteTransactionSchema.parse(req.body)

    const result = await bulkDeleteTransactionService(userId, transactionIds)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Transaction deleted successfully',
      ...result
    })
  }
)

export const bulkTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
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

    const result = await scanReceiptService(file)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Reciept scanned successfully',
      data: result
    })
  }
)

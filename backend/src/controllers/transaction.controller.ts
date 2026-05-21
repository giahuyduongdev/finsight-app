import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { logger } from '../config/logger.config'
import { transactionQueue, receiptQueue } from '../queues'
import { TRANSACTION_JOBS } from '../queues/transaction.queue'
import { RECEIPT_JOBS } from '../queues/receipt.queue'
import importBatchModel from '../models/import-batch.model'
import { getIO } from '../config/socket.config'
import { getUserId } from '../utils/getUserId.util'
import { container } from '../container'
import { toTransactionDTO, toTransactionDTOArray } from '../dtos'
import { TransactionFilterQuery } from '../types/query-filters.type'
import { parsePaginationQuery } from '../utils/query-parser.util'
import { ResponseFormatter } from '../utils/responseFormatter.util'

// Get TransactionService instance from DI container
const transactionService = container.getTransactionService()

export const createTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const userId = getUserId(req)

    const transaction = await transactionService.create(body, userId)

    const io = getIO()
    io.to(userId).emit('transaction:created', transaction)

    return res.status(HTTPSTATUS.CREATED).json(
      ResponseFormatter.success(toTransactionDTO(transaction), {
        message: 'Transaction created successfully'
      })
    )
  }
)

export const getAllTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)

    const filters: TransactionFilterQuery = {
      keyword: req.query.keyword as string | undefined,
      type: req.query.type as TransactionFilterQuery['type'],
      recurringStatus: req.query
        .recurringStatus as TransactionFilterQuery['recurringStatus'],
      currency: req.query.currency as TransactionFilterQuery['currency'],
      status: req.query.status as TransactionFilterQuery['status'],
      dateRangePreset: req.query
        .dateRangePreset as TransactionFilterQuery['dateRangePreset'],
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      timezone: req.query.timezone as string | undefined
    }

    const pagination = parsePaginationQuery(req.query)

    const result = await transactionService.findByUserId(
      userId,
      filters,
      pagination
    )
    return res
      .status(HTTPSTATUS.OK)
      .json(
        ResponseFormatter.paginated(
          toTransactionDTOArray(result.data),
          result.pagination,
          req
        )
      )
  }
)

export const getTransactionByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const transactionId = req.params.id as string

    const transaction = await transactionService.findById(userId, transactionId)

    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(toTransactionDTO(transaction), {
        message: 'Transaction fetched successfully'
      })
    )
  }
)

export const getChildTransactionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const parentId = req.params.id as string

    const pagination = parsePaginationQuery(req.query, {
      pageSize: 10,
      pageNumber: 1
    })

    // Apply constraints: max 50, min 1
    const pageSize = Math.min(50, Math.max(1, pagination.pageSize))
    const pageNumber = Math.max(1, pagination.pageNumber)

    const result = await transactionService.findChildTransactions(
      userId,
      parentId,
      pageNumber,
      pageSize
    )

    return res
      .status(HTTPSTATUS.OK)
      .json(
        ResponseFormatter.paginated(
          toTransactionDTOArray(result.data),
          result.pagination,
          req
        )
      )
  }
)

export const duplicateTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const transactionId = req.params.id as string

    const transaction = await transactionService.duplicate(
      userId,
      transactionId
    )

    const io = getIO()
    io.to(userId).emit('transaction:created', transaction)

    const duplicatedTransaction = toTransactionDTO(transaction)

    return res
      .status(HTTPSTATUS.CREATED)
      .location(`/api/v1/transactions/${duplicatedTransaction._id}`)
      .json(
        ResponseFormatter.success(duplicatedTransaction, {
          message: 'Transaction duplicated successfully'
        })
      )
  }
)

export const updateTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const transactionId = req.params.id as string
    const body = req.body

    const updatedTransaction = await transactionService.update(
      userId,
      transactionId,
      body
    )

    const io = getIO()
    io.to(userId).emit('transaction:updated', updatedTransaction)

    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(toTransactionDTO(updatedTransaction), {
        message: 'Transaction updated successfully'
      })
    )
  }
)

export const deleteTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const transactionId = req.params.id as string

    await transactionService.deleteById(userId, transactionId)

    const io = getIO()
    io.to(userId).emit('transaction:deleted', { _id: transactionId })

    return res.status(HTTPSTATUS.NO_CONTENT).send()
  }
)

export const bulkDeleteTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const { transactionIds } = req.body

    await transactionService.bulkDelete(userId, transactionIds)

    const io = getIO()
    io.to(userId).emit('transaction:bulk-deleted', { ids: transactionIds })

    return res.status(HTTPSTATUS.NO_CONTENT).send()
  }
)

export const bulkTransactionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const { transactions } = req.body

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
    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(
        {
          batchId: batch._id, // Trả cái này về để FE có thể làm chức năng "Kiểm tra tiến độ"
          jobId: job.id
        },
        { message: 'Bulk import is being processed' }
      )
    )
  }
)

// Import sharp at module level for better performance
import sharp from 'sharp'

export const scanReceiptController = asyncHandler(
  async (req: Request, res: Response) => {
    const file = req?.file
    const userId = getUserId(req)

    if (!file) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: 'No file uploaded'
      })
    }

    // File validation
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

    // [OPTIMIZED] Compress image in controller and send base64 to Redis
    // This provides fast response (~250ms) while keeping Redis payload reasonable (~2.66MB)
    // Trade-off: Redis usage vs response time (optimized for UX)

    try {
      // Compress image before sending to queue
      const compressedBuffer = await sharp(file.buffer)
        .resize({ width: 1024, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()

      // Convert to base64 for queue
      const base64String = compressedBuffer.toString('base64')

      // Send base64 to queue (fast response)
      const job = await receiptQueue.add(RECEIPT_JOBS.SCAN_RECEIPT, {
        userId,
        fileBuffer: base64String,
        fileName: file.originalname,
        fileSize: file.size,
        correlationId: req.correlationId
      })

      return res.status(HTTPSTATUS.ACCEPTED).json(
        ResponseFormatter.success(
          {
            jobId: job.id?.toString() || 'unknown'
          },
          { message: 'Receipt is being processed' }
        )
      )
    } catch (error) {
      const err = error as Error
      logger.error('[APP:Transaction] Failed to process receipt image', {
        error: err,
        userId,
        fileName: file.originalname,
        fileSize: file.size
      })
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Internal server error'
      })
    }
  }
)

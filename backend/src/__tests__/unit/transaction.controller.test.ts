import express, { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import {
  bulkDeleteTransactionController,
  deleteTransactionController,
  duplicateTransactionController,
  getAllTransactionController,
  getChildTransactionsController,
  scanReceiptController
} from '../../controllers/transaction.controller'
import { HTTPSTATUS } from '../../config/http.config'
import { NotFoundException } from '../../utils/errors'
import { validate } from '../../middlewares/validate.middleware'
import { errorHandler } from '../../middlewares/errorHandler.middleware'
import {
  bulkDeleteTransactionSchema,
  transactionIdSchema
} from '../../validators/transaction.validator'
import sharp from 'sharp'
import { redis } from '../../config/redis.config'
import {
  getReceiptScanCacheKey,
  hashReceiptImage
} from '../../utils/receipt/scan-cache.util'

const mockDeleteById = jest.fn()
const mockBulkDelete = jest.fn()
const mockDuplicate = jest.fn()
const mockFindByUserId = jest.fn()
const mockFindChildTransactions = jest.fn()
const mockEmit = jest.fn()
const mockTo = jest.fn(() => ({ emit: mockEmit }))
const mockExtractReceiptDataFromBase64 = jest.fn()
const mockUploadReceiptImageToCloudinary = jest.fn()

jest.mock('../../container', () => ({
  container: {
    getTransactionService: () => ({
      deleteById: (...args: unknown[]) => mockDeleteById(...args),
      bulkDelete: (...args: unknown[]) => mockBulkDelete(...args),
      duplicate: (...args: unknown[]) => mockDuplicate(...args),
      findByUserId: (...args: unknown[]) => mockFindByUserId(...args),
      findChildTransactions: (...args: unknown[]) =>
        mockFindChildTransactions(...args)
    })
  }
}))

jest.mock('../../queues', () => ({
  transactionQueue: {
    add: jest.fn()
  },
  receiptQueue: {
    add: jest.fn()
  }
}))

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn()
  })),
  FlowProducer: jest.fn().mockImplementation(() => ({
    close: jest.fn()
  }))
}))

jest.mock('../../config/bull/bullmq.config', () => ({
  bullMQConnection: {
    on: jest.fn(),
    quit: jest.fn()
  }
}))

jest.mock('../../models/import-batch.model', () => ({
  create: jest.fn()
}))

jest.mock('sharp', () => jest.fn())

jest.mock('../../utils/receipt/ai.util', () => ({
  extractReceiptDataFromBase64: (...args: unknown[]) =>
    mockExtractReceiptDataFromBase64(...args),
  NonReceiptImageError: class NonReceiptImageError extends Error {}
}))

jest.mock('../../utils/receipt/upload.util', () => ({
  uploadReceiptImageToCloudinary: (...args: unknown[]) =>
    mockUploadReceiptImageToCloudinary(...args)
}))

jest.mock('../../config/socket.config', () => ({
  getIO: () => ({
    to: mockTo
  })
}))

jest.mock('../../utils/getUserId.util', () => ({
  getUserId: () => 'user-123'
}))

const createMockTransaction = (overrides: Record<string, unknown> = {}) => ({
  toObject: () => ({
    _id: '507f1f77bcf86cd799439011',
    userId: 'user-123',
    title: 'Coffee',
    type: 'EXPENSE',
    amount: 5,
    currency: 'USD',
    category: 'Food',
    date: new Date('2026-05-15T00:00:00.000Z'),
    description: 'Morning coffee',
    isRecurring: false,
    recurringInterval: undefined,
    status: 'COMPLETED',
    paymentMethod: 'CASH',
    receiptUrl: undefined,
    createdAt: new Date('2026-05-15T00:00:00.000Z'),
    updatedAt: new Date('2026-05-15T00:00:00.000Z'),
    ...overrides
  })
})

describe('transaction.controller', () => {
  let mockResponse: Partial<Response>
  let nextMock: jest.MockedFunction<NextFunction>
  let statusMock: jest.Mock
  let locationMock: jest.Mock
  let sendMock: jest.Mock
  let jsonMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    const toBufferMock = jest.fn().mockResolvedValue(Buffer.from('compressed'))
    const jpegMock = jest.fn().mockReturnValue({ toBuffer: toBufferMock })
    const resizeMock = jest.fn().mockReturnValue({ jpeg: jpegMock })
    ;(sharp as unknown as jest.Mock).mockReturnValue({ resize: resizeMock })

    sendMock = jest.fn()
    jsonMock = jest.fn()
    mockResponse = {
      send: sendMock,
      json: jsonMock
    }
    statusMock = jest.fn().mockReturnValue(mockResponse)
    locationMock = jest.fn().mockReturnValue(mockResponse)
    mockResponse.status = statusMock
    mockResponse.location = locationMock

    nextMock = jest.fn()
  })

  describe('getAllTransactionController', () => {
    it('should return standardized paginated transaction response with links', async () => {
      const transaction = createMockTransaction()
      mockFindByUserId.mockResolvedValue({
        data: [transaction],
        pagination: {
          pageSize: 10,
          pageNumber: 2,
          totalCount: 21,
          totalPages: 3
        }
      })

      const mockRequest: Partial<Request> = {
        query: {
          pageSize: '10',
          pageNumber: '2',
          keyword: 'coffee'
        },
        protocol: 'http',
        path: '/api/v1/transactions',
        get: jest.fn().mockReturnValue('localhost:5000')
      }

      await getAllTransactionController(
        mockRequest as Request,
        mockResponse as Response,
        nextMock
      )

      expect(mockFindByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ keyword: 'coffee' }),
        { pageSize: 10, pageNumber: 2 }
      )
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            _id: '507f1f77bcf86cd799439011',
            title: 'Coffee'
          })
        ],
        meta: {
          pagination: {
            pageSize: 10,
            pageNumber: 2,
            totalCount: 21,
            totalPages: 3
          }
        },
        links: {
          self: '/api/v1/transactions?keyword=coffee&pageNumber=2&pageSize=10',
          next: '/api/v1/transactions?keyword=coffee&pageNumber=3&pageSize=10',
          prev: '/api/v1/transactions?keyword=coffee&pageNumber=1&pageSize=10',
          first: '/api/v1/transactions?keyword=coffee&pageNumber=1&pageSize=10',
          last: '/api/v1/transactions?keyword=coffee&pageNumber=3&pageSize=10'
        }
      })
      expect(nextMock).not.toHaveBeenCalled()
    })
  })

  describe('getChildTransactionsController', () => {
    it('should return standardized paginated child transaction response with links', async () => {
      const parentId = '507f1f77bcf86cd799439010'
      const childTransaction = createMockTransaction({
        _id: '507f1f77bcf86cd799439013',
        parentTransactionId: parentId,
        title: 'Split coffee'
      })

      mockFindChildTransactions.mockResolvedValue({
        data: [childTransaction],
        pagination: {
          pageSize: 10,
          pageNumber: 1,
          totalCount: 1,
          totalPages: 1
        }
      })

      const mockRequest: Partial<Request> = {
        params: { id: parentId },
        query: {},
        protocol: 'http',
        path: `/api/v1/transactions/${parentId}/children`,
        get: jest.fn().mockReturnValue('localhost:5000')
      }

      await getChildTransactionsController(
        mockRequest as Request,
        mockResponse as Response,
        nextMock
      )

      expect(mockFindChildTransactions).toHaveBeenCalledWith(
        'user-123',
        parentId,
        1,
        10
      )
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            _id: '507f1f77bcf86cd799439013',
            title: 'Split coffee'
          })
        ],
        meta: {
          pagination: {
            pageSize: 10,
            pageNumber: 1,
            totalCount: 1,
            totalPages: 1
          }
        },
        links: {
          self: `/api/v1/transactions/${parentId}/children?pageNumber=1&pageSize=10`,
          first: `/api/v1/transactions/${parentId}/children?pageNumber=1&pageSize=10`,
          last: `/api/v1/transactions/${parentId}/children?pageNumber=1&pageSize=10`
        }
      })
      expect(nextMock).not.toHaveBeenCalled()
    })
  })

  describe('duplicateTransactionController', () => {
    const duplicatedTransactionId = '507f1f77bcf86cd799439012'
    let mockRequest: Partial<Request>

    beforeEach(() => {
      mockRequest = {
        params: {
          id: '507f1f77bcf86cd799439011'
        }
      }
    })

    it('should return 201 Created with Location header and duplicated transaction body', async () => {
      const duplicatedTransaction = {
        toObject: () => ({
          _id: duplicatedTransactionId,
          userId: 'user-123',
          title: 'Duplicate - Coffee',
          type: 'EXPENSE',
          amount: 5,
          currency: 'USD',
          category: 'Food',
          date: new Date('2026-05-15T00:00:00.000Z'),
          description: 'Duplicated transaction',
          isRecurring: false,
          recurringInterval: undefined,
          status: 'COMPLETED',
          paymentMethod: 'CASH',
          receiptUrl: undefined,
          createdAt: new Date('2026-05-15T00:00:00.000Z'),
          updatedAt: new Date('2026-05-15T00:00:00.000Z')
        })
      }
      mockDuplicate.mockResolvedValue(duplicatedTransaction)

      await duplicateTransactionController(
        mockRequest as Request,
        mockResponse as Response,
        nextMock
      )

      expect(mockDuplicate).toHaveBeenCalledWith(
        'user-123',
        '507f1f77bcf86cd799439011'
      )
      expect(mockTo).toHaveBeenCalledWith('user-123')
      expect(mockEmit).toHaveBeenCalledWith(
        'transaction:created',
        duplicatedTransaction
      )
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.CREATED)
      expect(locationMock).toHaveBeenCalledWith(
        `/api/v1/transactions/${duplicatedTransactionId}`
      )
      expect(jsonMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          _id: duplicatedTransactionId,
          title: 'Duplicate - Coffee'
        }),
        meta: { message: 'Transaction duplicated successfully' }
      })
      expect(nextMock).not.toHaveBeenCalled()
    })

    it('should forward duplicate failures to the error handler', async () => {
      const error = new NotFoundException('Transaction not found')
      mockDuplicate.mockRejectedValue(error)

      await duplicateTransactionController(
        mockRequest as Request,
        mockResponse as Response,
        nextMock
      )

      expect(nextMock).toHaveBeenCalledWith(error)
      expect(error.statusCode).toBe(HTTPSTATUS.NOT_FOUND)
      expect(statusMock).not.toHaveBeenCalled()
      expect(locationMock).not.toHaveBeenCalled()
      expect(jsonMock).not.toHaveBeenCalled()
    })
  })

  describe('deleteTransactionController', () => {
    let mockRequest: Partial<Request>

    beforeEach(() => {
      mockRequest = {
        params: {
          id: '507f1f77bcf86cd799439011'
        }
      }
    })

    it('should return 204 No Content with no response body when delete succeeds', async () => {
      mockDeleteById.mockResolvedValue(undefined)

      await deleteTransactionController(
        mockRequest as Request,
        mockResponse as Response,
        nextMock
      )

      expect(mockDeleteById).toHaveBeenCalledWith(
        'user-123',
        '507f1f77bcf86cd799439011'
      )
      expect(mockTo).toHaveBeenCalledWith('user-123')
      expect(mockEmit).toHaveBeenCalledWith('transaction:deleted', {
        _id: '507f1f77bcf86cd799439011'
      })
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.NO_CONTENT)
      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock).toHaveBeenCalledWith()
      expect(jsonMock).not.toHaveBeenCalled()
      expect(nextMock).not.toHaveBeenCalled()
    })

    it('should forward delete failures to the error handler', async () => {
      const error = new NotFoundException('Transaction not found')
      mockDeleteById.mockRejectedValue(error)

      await deleteTransactionController(
        mockRequest as Request,
        mockResponse as Response,
        nextMock
      )

      expect(nextMock).toHaveBeenCalledWith(error)
      expect(error.statusCode).toBe(HTTPSTATUS.NOT_FOUND)
      expect(statusMock).not.toHaveBeenCalled()
      expect(sendMock).not.toHaveBeenCalled()
      expect(jsonMock).not.toHaveBeenCalled()
    })
  })

  describe('bulkDeleteTransactionController', () => {
    let mockRequest: Partial<Request>

    beforeEach(() => {
      mockRequest = {
        body: {
          transactionIds: ['507f1f77bcf86cd799439011']
        }
      }
    })

    it('should return 204 No Content with no response body when bulk delete succeeds', async () => {
      mockBulkDelete.mockResolvedValue({ success: true, deletedCount: 1 })

      await bulkDeleteTransactionController(
        mockRequest as Request,
        mockResponse as Response,
        nextMock
      )

      expect(mockBulkDelete).toHaveBeenCalledWith('user-123', [
        '507f1f77bcf86cd799439011'
      ])
      expect(mockTo).toHaveBeenCalledWith('user-123')
      expect(mockEmit).toHaveBeenCalledWith('transaction:bulk-deleted', {
        ids: ['507f1f77bcf86cd799439011']
      })
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.NO_CONTENT)
      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock).toHaveBeenCalledWith()
      expect(jsonMock).not.toHaveBeenCalled()
      expect(nextMock).not.toHaveBeenCalled()
    })

    it('should forward bulk delete failures to the error handler', async () => {
      const error = new NotFoundException('No transactions found')
      mockBulkDelete.mockRejectedValue(error)

      await bulkDeleteTransactionController(
        mockRequest as Request,
        mockResponse as Response,
        nextMock
      )

      expect(nextMock).toHaveBeenCalledWith(error)
      expect(error.statusCode).toBe(HTTPSTATUS.NOT_FOUND)
      expect(statusMock).not.toHaveBeenCalled()
      expect(sendMock).not.toHaveBeenCalled()
      expect(jsonMock).not.toHaveBeenCalled()
    })
  })

  describe('scanReceiptController', () => {
    const createReceiptRequest = (): Partial<Request> => ({
      file: {
        buffer: Buffer.from('original image'),
        mimetype: 'image/jpeg',
        size: 1024,
        originalname: 'receipt.jpg'
      } as Express.Multer.File,
      correlationId: 'correlation-123'
    })

    it('should return cached receipt immediately when scan cache hits', async () => {
      const compressedBuffer = Buffer.from('compressed')
      const imageHash = hashReceiptImage(compressedBuffer)
      const cachedReceipt = {
        data: {
          title: 'Coffee',
          amount: 5,
          currency: 'USD',
          date: '2026-05-25',
          description: 'Morning coffee',
          category: 'Food',
          paymentMethod: 'CASH',
          type: 'EXPENSE',
          status: 'COMPLETED',
          receiptUrl: 'https://res.cloudinary.com/demo/receipt.jpg'
        },
        cachedAt: '2026-05-25T00:00:00.000Z'
      }
      ;(redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedReceipt))

      await scanReceiptController(
        createReceiptRequest() as Request,
        mockResponse as Response,
        nextMock
      )

      expect(redis.get).toHaveBeenCalledWith(
        getReceiptScanCacheKey('user-123', imageHash)
      )
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          receipt: cachedReceipt.data
        },
        meta: { message: 'Receipt scan loaded from cache' }
      })
      expect(mockExtractReceiptDataFromBase64).not.toHaveBeenCalled()
      expect(mockUploadReceiptImageToCloudinary).not.toHaveBeenCalled()
      expect(redis.set).not.toHaveBeenCalled()
    })

    it('should return a job id on cache miss and cache the background scan result', async () => {
      const compressedBuffer = Buffer.from('compressed')
      const imageHash = hashReceiptImage(compressedBuffer)
      const extractedReceipt = {
        title: 'Coffee',
        amount: 5,
        currency: 'USD',
        date: '2026-05-25',
        description: 'Morning coffee',
        category: 'Food',
        paymentMethod: 'CASH',
        type: 'EXPENSE',
        status: 'COMPLETED'
      }
      ;(redis.get as jest.Mock).mockResolvedValue(null)
      mockExtractReceiptDataFromBase64.mockResolvedValue(extractedReceipt)
      mockUploadReceiptImageToCloudinary.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/new-receipt.jpg',
        public_id: `receipts/user-123/${imageHash}`
      })

      await scanReceiptController(
        createReceiptRequest() as Request,
        mockResponse as Response,
        nextMock
      )

      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.ACCEPTED)
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          jobId: expect.stringMatching(/^receipt-scan-/)
        },
        meta: { message: 'Receipt is being processed' }
      })

      await new Promise((resolve) => setImmediate(resolve))

      const jobId = jsonMock.mock.calls[0][0].data.jobId
      const receiptData = {
        ...extractedReceipt,
        receiptUrl: 'https://res.cloudinary.com/demo/new-receipt.jpg'
      }
      expect(mockExtractReceiptDataFromBase64).toHaveBeenCalledWith(
        compressedBuffer.toString('base64')
      )
      expect(mockUploadReceiptImageToCloudinary).toHaveBeenCalledWith(
        compressedBuffer,
        {
          publicId: `receipts/user-123/${imageHash}`
        }
      )
      expect(redis.set).toHaveBeenCalledWith(
        getReceiptScanCacheKey('user-123', imageHash),
        expect.stringContaining(
          '"receiptUrl":"https://res.cloudinary.com/demo/new-receipt.jpg"'
        ),
        'EX',
        86400
      )
      expect(mockTo).toHaveBeenCalledWith('user-123')
      expect(mockEmit).toHaveBeenCalledWith('receipt:scan-completed', {
        jobId,
        data: receiptData
      })
    })
  })

  describe('DELETE validation errors', () => {
    it('should return 400 with error body for invalid transaction ID', async () => {
      const app = express()
      app.delete(
        '/transactions/:id',
        validate(transactionIdSchema, 'params'),
        (_req, res) => res.status(HTTPSTATUS.NO_CONTENT).send()
      )
      app.use(errorHandler)

      const response = await request(app).delete('/transactions/invalid-id')

      expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
      expect(response.body.error).toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: HTTPSTATUS.BAD_REQUEST
        })
      )
    })

    it('should return 400 with error body for invalid bulk delete body', async () => {
      const app = express()
      app.use(express.json())
      app.delete(
        '/transactions/bulk',
        validate(bulkDeleteTransactionSchema, 'body'),
        (_req, res) => res.status(HTTPSTATUS.NO_CONTENT).send()
      )
      app.use(errorHandler)

      const response = await request(app)
        .delete('/transactions/bulk')
        .send({ transactionIds: ['invalid-id'] })

      expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
      expect(response.body.error).toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: HTTPSTATUS.BAD_REQUEST
        })
      )
    })
  })

  describe('duplicate validation errors', () => {
    it('should return 400 with error body for invalid source transaction ID', async () => {
      const app = express()
      app.post(
        '/transactions/:id/duplicate',
        validate(transactionIdSchema, 'params'),
        (_req, res) => res.status(HTTPSTATUS.CREATED).send()
      )
      app.use(errorHandler)

      const response = await request(app).post(
        '/transactions/invalid-id/duplicate'
      )

      expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
      expect(response.body.error).toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: HTTPSTATUS.BAD_REQUEST
        })
      )
    })
  })
})

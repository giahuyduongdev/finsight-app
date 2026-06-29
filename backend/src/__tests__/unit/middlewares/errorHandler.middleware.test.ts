import { Request, Response, NextFunction } from 'express'
import { ZodError, z } from 'zod'
import { MulterError } from 'multer'
import { errorHandler } from '../../../middlewares/errorHandler.middleware'
import { AppError } from '../../../utils/errors/index'
import { ErrorCodeEnum } from '../../../enums/error-code.enum'
import { logger } from '../../../config/logger.config'
import { HTTPSTATUS } from '../../../config/http.config'
import { Env } from '../../../config/env.config'

// Mock logger
jest.mock('../../../config/logger.config', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn()
  }
}))

// Mock environment
jest.mock('../../../config/env.config', () => ({
  Env: {
    NODE_ENV: 'test'
  }
}))

describe('errorHandler middleware - Logging Strategy', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    Env.NODE_ENV = 'test'

    // Setup response mock
    jsonMock = jest.fn()
    statusMock = jest.fn().mockReturnValue({ json: jsonMock })

    mockRequest = {
      correlationId: 'test-correlation-id',
      path: '/api/test',
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'secret123'
      }
    }

    mockResponse = {
      status: statusMock
    }

    mockNext = jest.fn()
  })

  describe('Standardized Error Response Format', () => {
    it('should return standardized response for ZodError', () => {
      const schema = z.object({ email: z.string().email() })
      let zodError: ZodError

      try {
        schema.parse({ email: 'invalid' })
      } catch (error) {
        zodError = error as ZodError
      }

      errorHandler(
        zodError!,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.BAD_REQUEST)
      expect(jsonMock).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: ErrorCodeEnum.VALIDATION_ERROR,
          message: 'Validation failed',
          userMessage: expect.any(String),
          statusCode: HTTPSTATUS.BAD_REQUEST,
          requestId: 'test-correlation-id',
          timestamp: expect.any(String),
          path: '/api/test',
          method: 'POST',
          details: [
            expect.objectContaining({
              field: 'email',
              message: expect.any(String)
            })
          ]
        })
      })
    })

    it('should return standardized response for MulterError', () => {
      const error = new MulterError('LIMIT_FILE_SIZE')

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.BAD_REQUEST)
      expect(jsonMock).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: ErrorCodeEnum.FILE_UPLOAD_ERROR,
          message: 'File size exceeds the limit',
          userMessage: expect.any(String),
          statusCode: HTTPSTATUS.BAD_REQUEST,
          requestId: 'test-correlation-id',
          timestamp: expect.any(String),
          path: '/api/test',
          method: 'POST'
        })
      })
    })

    it('should return standardized response for AppError', () => {
      const error = new AppError(
        'Transaction not found',
        HTTPSTATUS.NOT_FOUND,
        ErrorCodeEnum.RESOURCE_NOT_FOUND
      )

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.NOT_FOUND)
      expect(jsonMock).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: ErrorCodeEnum.RESOURCE_NOT_FOUND,
          message: 'Transaction not found',
          userMessage: expect.any(String),
          statusCode: HTTPSTATUS.NOT_FOUND,
          requestId: 'test-correlation-id',
          timestamp: expect.any(String),
          path: '/api/test',
          method: 'POST'
        })
      })
    })

    it('should return standardized response for generic errors', () => {
      const error = new Error('Unexpected database error')

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.INTERNAL_SERVER_ERROR)
      expect(jsonMock).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal Server Error',
          userMessage: expect.any(String),
          statusCode: HTTPSTATUS.INTERNAL_SERVER_ERROR,
          requestId: 'test-correlation-id',
          timestamp: expect.any(String),
          path: '/api/test',
          method: 'POST',
          stack: expect.stringContaining('Unexpected database error')
        })
      })
    })

    it('should include timestamp in ISO 8601 format', () => {
      const error = new AppError(
        'Invalid request',
        HTTPSTATUS.BAD_REQUEST,
        ErrorCodeEnum.VALIDATION_ERROR
      )

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      const response = jsonMock.mock.calls[0][0]
      const timestamp = response.error.timestamp
      expect(new Date(timestamp).toISOString()).toBe(timestamp)
    })

    it('should not include stack trace in production responses', () => {
      Env.NODE_ENV = 'production'
      const error = new Error('Production server error')

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(jsonMock).toHaveBeenCalledWith({
        error: expect.not.objectContaining({
          stack: expect.any(String)
        })
      })
    })
  })

  describe('4xx Client Errors - WARN Level Logging', () => {
    it('should log 4xx errors at WARN level without stack trace', () => {
      // Arrange
      const error = new AppError(
        'User not found',
        HTTPSTATUS.NOT_FOUND,
        ErrorCodeEnum.AUTH_USER_NOT_FOUND
      )

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.error).not.toHaveBeenCalled()

      const warnCall = (logger.warn as jest.Mock).mock.calls[0]
      expect(warnCall[0]).toContain('[APP:Server]')
      expect(warnCall[0]).toContain('[POST]')
      expect(warnCall[0]).toContain('/api/test')

      // Verify no stack trace in log metadata
      const logMetadata = warnCall[1]
      expect(logMetadata).toHaveProperty('error')
      expect(logMetadata).toMatchObject({
        requestId: 'test-correlation-id',
        statusCode: HTTPSTATUS.NOT_FOUND,
        errorCode: ErrorCodeEnum.AUTH_USER_NOT_FOUND,
        path: '/api/test',
        method: 'POST'
      })
      expect(logMetadata).not.toHaveProperty('stack')
      expect(logMetadata).not.toHaveProperty('body')
      expect(logMetadata.error).toBe('User not found')
    })

    it('should log validation errors (400) at WARN level', () => {
      // Arrange
      const schema = z.object({ email: z.string().email() })
      let zodError: ZodError

      try {
        schema.parse({ email: 'invalid' })
      } catch (error) {
        zodError = error as ZodError
      }

      // Act
      errorHandler(
        zodError!,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.error).not.toHaveBeenCalled()

      const warnCall = (logger.warn as jest.Mock).mock.calls[0]
      const logMetadata = warnCall[1]
      expect(logMetadata).not.toHaveProperty('stack')
    })

    it('should log authentication errors (401) at WARN level', () => {
      // Arrange
      const error = new AppError(
        'Invalid credentials',
        HTTPSTATUS.UNAUTHORIZED,
        ErrorCodeEnum.AUTH_INVALID_TOKEN
      )

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.error).not.toHaveBeenCalled()
    })

    it('should log forbidden errors (403) at WARN level', () => {
      // Arrange
      const error = new AppError(
        'Access forbidden',
        HTTPSTATUS.FORBIDDEN,
        ErrorCodeEnum.ACCESS_FORBIDDEN
      )

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe('5xx Server Errors - ERROR Level Logging', () => {
    it('should log 5xx errors at ERROR level with full stack trace', () => {
      // Arrange
      const error = new Error('Database connection failed')
      error.stack = 'Error: Database connection failed\n    at someFunction'

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.warn).not.toHaveBeenCalled()

      const errorCall = (logger.error as jest.Mock).mock.calls[0]
      expect(errorCall[0]).toContain('[APP:Server]')
      expect(errorCall[0]).toContain('[POST]')
      expect(errorCall[0]).toContain('/api/test')

      // Verify stack trace is included in log metadata
      const logMetadata = errorCall[1]
      expect(logMetadata).toMatchObject({
        requestId: 'test-correlation-id',
        statusCode: HTTPSTATUS.INTERNAL_SERVER_ERROR,
        errorCode: 'INTERNAL_SERVER_ERROR',
        path: '/api/test',
        method: 'POST'
      })
      expect(logMetadata).toHaveProperty(
        'message',
        'Database connection failed'
      )
      expect(logMetadata).toHaveProperty('stack')
      expect(logMetadata.stack).toContain('Database connection failed')
      expect(logMetadata.stack).toContain('at someFunction')
    })

    it('should log internal server errors (500) at ERROR level', () => {
      // Arrange
      const error = new AppError(
        'Internal server error',
        HTTPSTATUS.INTERNAL_SERVER_ERROR,
        ErrorCodeEnum.INTERNAL_SERVER_ERROR
      )
      error.stack = 'Error: Internal server error\n    at handler'

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.warn).not.toHaveBeenCalled()

      const errorCall = (logger.error as jest.Mock).mock.calls[0]
      const logMetadata = errorCall[1]
      expect(logMetadata).toHaveProperty('stack')
    })

    it('should log service unavailable errors (503) at ERROR level', () => {
      // Arrange
      const error = new AppError(
        'Service unavailable',
        HTTPSTATUS.SERVICE_UNAVAILABLE,
        ErrorCodeEnum.INTERNAL_SERVER_ERROR
      )

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.warn).not.toHaveBeenCalled()
    })
  })

  describe('Sensitive Data Redaction in Logs', () => {
    it('should redact sensitive data from request body in 5xx error logs', () => {
      // Arrange
      const error = new Error('Database error')
      mockRequest.body = {
        email: 'test@example.com',
        password: 'secret123',
        token: 'bearer-token-xyz',
        apiKey: 'api-key-123'
      }

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.error).toHaveBeenCalledTimes(1)

      const errorCall = (logger.error as jest.Mock).mock.calls[0]
      const logMetadata = errorCall[1]

      // Verify sensitive fields are redacted
      expect(logMetadata.body).toBeDefined()
      expect(logMetadata.body.email).toBe('t***@example.com')
      expect(logMetadata.body.password).toBe('[REDACTED]')
      expect(logMetadata.body.token).toBe('[REDACTED]')
      expect(logMetadata.body.apiKey).toBe('[REDACTED]')
    })

    it('should not log request body for 4xx errors', () => {
      // Arrange
      const error = new AppError(
        'Validation failed',
        HTTPSTATUS.BAD_REQUEST,
        ErrorCodeEnum.VALIDATION_ERROR
      )
      mockRequest.body = {
        password: 'secret123'
      }

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.warn).toHaveBeenCalledTimes(1)

      const warnCall = (logger.warn as jest.Mock).mock.calls[0]
      const logMetadata = warnCall[1]

      // 4xx errors should not include body in logs
      expect(logMetadata).not.toHaveProperty('body')
    })
  })

  describe('Log Message Format', () => {
    it('should include method, path, and error message in log', () => {
      // Arrange
      const error = new AppError(
        'Transaction not found',
        HTTPSTATUS.NOT_FOUND,
        ErrorCodeEnum.RESOURCE_NOT_FOUND
      )
      mockRequest = {
        ...mockRequest,
        method: 'GET',
        path: '/api/v1/transactions/123'
      }

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      const warnCall = (logger.warn as jest.Mock).mock.calls[0]
      const logMessage = warnCall[0]

      expect(logMessage).toContain('[APP:Server]')
      expect(logMessage).toContain('[GET]')
      expect(logMessage).toContain('/api/v1/transactions/123')
      expect(logMessage).toContain('Transaction not found')
    })

    it('should use correlation ID from request', () => {
      // Arrange
      const error = new Error('Server error')
      mockRequest.correlationId = 'correlation-123'

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.INTERNAL_SERVER_ERROR)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            requestId: 'correlation-123'
          })
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle errors without stack trace gracefully', () => {
      // Arrange
      const error = new Error('Error without stack')
      delete error.stack

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.error).toHaveBeenCalledTimes(1)

      const errorCall = (logger.error as jest.Mock).mock.calls[0]
      const logMetadata = errorCall[1]

      // Should still log, but stack will be undefined
      expect(logMetadata).toHaveProperty('stack', undefined)
    })

    it('should handle errors without message gracefully', () => {
      // Arrange
      const error = new Error()

      // Act
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(logger.error).toHaveBeenCalledTimes(1)

      const errorCall = (logger.error as jest.Mock).mock.calls[0]
      const logMetadata = errorCall[1]

      expect(logMetadata).toHaveProperty('message')
    })
  })
})

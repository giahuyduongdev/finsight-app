import { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { MulterError } from 'multer'
import { HTTPSTATUS } from '../config/http.config'
import { AppError } from '../utils/errors/index'
import { ErrorCodeEnum } from '../enums/error-code.enum'
import { logger } from '../config/logger.config'
import { getUserMessage } from '../utils/userMessage.util'
import { redactSensitiveFields } from '../utils/redact.util'
import { Env } from '../config/env.config'
import { captureSentryError } from '../config/sentry.config'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatZodError = (error: ZodError) => ({
  status: HTTPSTATUS.BAD_REQUEST,
  body: {
    message: 'Validation failed',
    errors: error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message
    })),
    errorCode: ErrorCodeEnum.VALIDATION_ERROR
  }
})

const formatMulterError = (error: MulterError) => {
  const messages: Record<string, string> = {
    LIMIT_UNEXPECTED_FILE: "Invalid file field name. Please use 'file'",
    LIMIT_FILE_SIZE: 'File size exceeds the limit',
    LIMIT_FILE_COUNT: 'Too many files uploaded'
  }

  return {
    status: HTTPSTATUS.BAD_REQUEST,
    body: {
      message: messages[error.code] ?? 'File upload error',
      error: error.message,
      errorCode: ErrorCodeEnum.FILE_UPLOAD_ERROR
    }
  }
}

// ─── Error Handler ────────────────────────────────────────────────────────────

export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  _next
): void => {
  // 1. Khởi tạo mặc định là lỗi 500 (Internal Server Error)
  let statusCode = HTTPSTATUS.INTERNAL_SERVER_ERROR
  let responseBody: Record<string, unknown> = {
    message: 'Internal Server Error',
    error: error?.message ?? 'Unknown error occurred'
  }

  // 2. Phân loại lỗi và gán lại statusCode + responseBody
  if (error instanceof SyntaxError && 'body' in error) {
    statusCode = HTTPSTATUS.BAD_REQUEST
    responseBody = {
      message: 'Invalid JSON format',
      errorCode: ErrorCodeEnum.VALIDATION_ERROR
    }
  } else if (error instanceof ZodError) {
    const formatted = formatZodError(error)
    statusCode = formatted.status
    responseBody = formatted.body
  } else if (error instanceof MulterError) {
    const formatted = formatMulterError(error)
    statusCode = formatted.status
    responseBody = formatted.body
  } else if (error instanceof AppError) {
    statusCode = error.statusCode
    responseBody = {
      message: error.message,
      errorCode: error.errorCode,
      ...(error.meta && { meta: error.meta })
    }
  }

  // 3. Build standardized error response following ErrorResponse interface
  const errorResponse: {
    error: {
      code: string
      message: string
      userMessage: string
      statusCode: number
      requestId: string
      timestamp: string
      path: string
      method: string
      details?: Array<{ field: string; message: string }>
      stack?: string
    }
  } = {
    error: {
      code: (responseBody.errorCode as string) || 'INTERNAL_SERVER_ERROR',
      message: responseBody.message as string,
      userMessage: getUserMessage(error, statusCode),
      statusCode,
      requestId: req.correlationId || 'unknown',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  }

  // Add validation details if present
  if (responseBody.errors && Array.isArray(responseBody.errors)) {
    errorResponse.error.details = responseBody.errors as Array<{
      field: string
      message: string
    }>
  }

  // Add stack trace only in development for server errors
  if (Env.NODE_ENV !== 'production' && error.stack && statusCode >= 500) {
    errorResponse.error.stack = error.stack
  }

  // 4. Redact sensitive fields in details if present
  if (errorResponse.error.details) {
    errorResponse.error.details = redactSensitiveFields(
      errorResponse.error.details
    ) as typeof errorResponse.error.details
  }

  // 5. Log appropriately based on error severity
  const logMessage = `[${req.method}] ${req.path} - ${errorResponse.error.message}`
  const logMetadata = {
    requestId: errorResponse.error.requestId,
    statusCode,
    errorCode: errorResponse.error.code,
    path: req.path,
    method: req.method,
    error: error?.message
  }

  if (statusCode < 500) {
    // Client errors (4xx): Log as WARN without stack trace
    logger.warn(`[APP:Server] ${logMessage}`, logMetadata)
  } else {
    // Server errors (5xx): Log as ERROR with stack trace and redacted body
    logger.error(`[APP:Server] ${logMessage}`, {
      ...logMetadata,
      message: error?.message,
      stack: error?.stack,
      body: redactSensitiveFields(req.body)
    })
    captureSentryError(error, req, statusCode)
  }

  // 6. Send standardized error response to client
  res.status(statusCode).json(errorResponse)
}

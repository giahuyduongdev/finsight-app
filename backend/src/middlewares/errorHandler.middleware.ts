import { ErrorRequestHandler } from 'express'
import { z, ZodError } from 'zod'
import { MulterError } from 'multer'
import { HTTPSTATUS } from '../config/http.config'
import { AppError } from '../utils/errors/index'
import { ErrorCodeEnum } from '../enums/error-code.enum'
import { logger } from '../config/logger.config'

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
  next
): any => {
  // 1. Khởi tạo mặc định là lỗi 500 (Internal Server Error)
  let statusCode = HTTPSTATUS.INTERNAL_SERVER_ERROR
  let responseBody: any = {
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

  // 3. CHIẾN THUẬT LOG THÔNG MINH
  const logMessage = `[${req.method}] ${req.path} - ${responseBody.message}`

  if (statusCode < 500) {
    // Lỗi Client (400, 401, 403, 404...): Chỉ đánh log cảnh báo (warn), KHÔNG in stack trace
    logger.warn(logMessage, {
      error: error?.message
    })
  } else {
    // Lỗi Server (500): Đánh log lỗi nghiêm trọng (error), CÓ in stack trace và payload để debug
    logger.error(logMessage, {
      message: error?.message,
      stack: error?.stack,
      body: req.body
    })
  }

  // 4. Trả response về cho Client
  return res.status(statusCode).json(responseBody)
}

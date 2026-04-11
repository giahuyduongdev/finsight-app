import { ErrorRequestHandler, Response } from 'express'
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
  logger.error(`[${req.method}] ${req.path}`, {
    message: error?.message,
    stack: error?.stack,
    body: req.body
  })

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: 'Invalid JSON format',
      errorCode: ErrorCodeEnum.VALIDATION_ERROR
    })
  }

  if (error instanceof ZodError) {
    const { status, body } = formatZodError(error)
    return res.status(status).json(body)
  }

  if (error instanceof MulterError) {
    const { status, body } = formatMulterError(error)
    return res.status(status).json(body)
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      errorCode: error.errorCode,
      ...(error.meta && { meta: error.meta })
    })
  }

  return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
    message: 'Internal Server Error',
    error: error?.message ?? 'Unknown error occurred'
  })
}

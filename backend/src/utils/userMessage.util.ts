import { ZodError } from 'zod'
import { ErrorCodeEnum, ErrorCodeEnumType } from '../enums/error-code.enum'

/**
 * Maps error codes to user-friendly messages
 * Provides clear, actionable messages for end users
 */
export const USER_MESSAGE_MAP: Record<ErrorCodeEnumType, string> = {
  // Access Control Errors
  [ErrorCodeEnum.ACCESS_UNAUTHORIZED]:
    'Authentication failed. Please check your credentials',
  [ErrorCodeEnum.ACCESS_FORBIDDEN]:
    'You do not have permission to perform this action',

  // Authentication Errors
  [ErrorCodeEnum.AUTH_USER_NOT_FOUND]:
    "We couldn't find your account. Please check and try again",
  [ErrorCodeEnum.AUTH_EMAIL_ALREADY_EXISTS]:
    'This email is already registered. Please log in or use a different email',
  [ErrorCodeEnum.AUTH_INVALID_TOKEN]:
    'Your session has expired. Please log in again',
  [ErrorCodeEnum.AUTH_EMAIL_PENDING_VERIFICATION]:
    'Verification failed. Please request a new code',
  [ErrorCodeEnum.AUTH_OTP_EXPIRED]:
    'Verification failed. Please request a new code',
  [ErrorCodeEnum.AUTH_OTP_INVALID]:
    'Verification failed. Please request a new code',
  [ErrorCodeEnum.AUTH_OTP_TOO_MANY_REQUESTS]:
    'Too many requests. Please try again later',
  [ErrorCodeEnum.AUTH_NOT_FOUND]:
    'Authentication failed. Please check your credentials',
  [ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS]:
    'Too many failed attempts. Please try again later',
  [ErrorCodeEnum.AUTH_UNAUTHORIZED_ACCESS]:
    'Authentication failed. Please check your credentials',
  [ErrorCodeEnum.AUTH_TOKEN_NOT_FOUND]:
    'Your session has expired. Please log in again',
  [ErrorCodeEnum.AUTH_TOKEN_INVALID]:
    'Your session has expired. Please log in again',
  [ErrorCodeEnum.AUTH_PASSWORD_MUST_BE_DIFFERENT]:
    'New password must be different from the current password',

  // Validation and Resource Errors
  [ErrorCodeEnum.VALIDATION_ERROR]: 'Please check your input and try again',
  [ErrorCodeEnum.RESOURCE_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCodeEnum.FILE_UPLOAD_ERROR]:
    'File upload failed. Please check the file and try again',

  // Request Errors
  [ErrorCodeEnum.REQUEST_TIMEOUT]:
    'The request took too long. Please try again',
  [ErrorCodeEnum.REQUEST_TOO_LARGE]:
    'The request is too large. Please reduce the size and try again',
  [ErrorCodeEnum.UNSUPPORTED_MEDIA_TYPE]:
    'The file type is not supported. Please use a different format',
  [ErrorCodeEnum.RATE_LIMIT_EXCEEDED]:
    'Too many requests. Please try again later',

  // System Errors
  [ErrorCodeEnum.INTERNAL_SERVER_ERROR]:
    'Something went wrong. Please try again later',
  [ErrorCodeEnum.SERVICE_UNAVAILABLE]:
    'Service is temporarily unavailable. Please try again later',
  [ErrorCodeEnum.CIRCUIT_BREAKER_OPEN]:
    'Service is temporarily unavailable. Please try again later',
  [ErrorCodeEnum.EXTERNAL_SERVICE_ERROR]:
    'External service is temporarily unavailable. Please try again later'
}

/**
 * Maps error types to user-friendly messages
 * @param error - The error object
 * @param statusCode - HTTP status code
 * @returns User-friendly error message
 */
export const getUserMessage = (error: unknown, statusCode: number): string => {
  // Handle null or undefined
  if (!error) {
    return statusCode >= 500
      ? 'Something went wrong. Please try again later'
      : 'An error occurred. Please try again'
  }

  // Type guard for error object
  const err = error as { errorCode?: string; message?: string }

  // Handle ZodError specifically
  if (error instanceof ZodError) {
    return USER_MESSAGE_MAP[ErrorCodeEnum.VALIDATION_ERROR]
  }

  // Map error code to user-friendly message
  if (err.errorCode && err.errorCode in ErrorCodeEnum) {
    const errorCode = err.errorCode as ErrorCodeEnumType
    return USER_MESSAGE_MAP[errorCode]
  }

  // Server errors (5xx)
  if (statusCode >= 500) {
    return 'Something went wrong. Please try again later'
  }

  // Default: generic error message
  return 'An error occurred. Please try again'
}

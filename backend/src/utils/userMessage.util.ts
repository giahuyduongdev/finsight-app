import { ZodError } from 'zod'

/**
 * Maps error types to user-friendly messages
 * @param error - The error object
 * @param statusCode - HTTP status code
 * @returns User-friendly error message
 */
export const getUserMessage = (error: unknown, statusCode: number): string => {
  // Type guard for error object
  const err = error as { errorCode?: string; message?: string }

  // Validation errors
  if (error instanceof ZodError || err.errorCode === 'VALIDATION_ERROR') {
    return 'Please check your input and try again'
  }

  // Registration errors
  if (err.errorCode === 'AUTH_EMAIL_ALREADY_EXISTS') {
    return 'This email is already registered. Please log in or use a different email'
  }

  // OTP/Verification errors
  if (
    err.errorCode === 'AUTH_OTP_EXPIRED' ||
    err.errorCode === 'AUTH_OTP_INVALID' ||
    err.errorCode === 'AUTH_EMAIL_PENDING_VERIFICATION'
  ) {
    return 'Verification failed. Please request a new code'
  }

  if (err.errorCode === 'AUTH_OTP_TOO_MANY_REQUESTS') {
    return 'Too many requests. Please try again later'
  }

  // Token/Session errors
  if (
    err.errorCode === 'AUTH_TOKEN_INVALID' ||
    err.errorCode === 'AUTH_TOKEN_NOT_FOUND' ||
    err.errorCode === 'AUTH_INVALID_TOKEN'
  ) {
    return 'Your session has expired. Please log in again'
  }

  // Login/Authentication errors
  if (
    err.errorCode === 'AUTH_USER_NOT_FOUND' ||
    err.errorCode === 'AUTH_NOT_FOUND' ||
    err.errorCode === 'ACCESS_UNAUTHORIZED' ||
    err.errorCode === 'AUTH_UNAUTHORIZED_ACCESS'
  ) {
    return 'Authentication failed. Please check your credentials'
  }

  // Password errors
  if (err.errorCode === 'AUTH_PASSWORD_MUST_BE_DIFFERENT') {
    return 'New password must be different from the current password'
  }

  // Rate limiting
  if (err.errorCode === 'AUTH_TOO_MANY_ATTEMPTS') {
    return 'Too many failed attempts. Please try again later'
  }

  // Authorization errors
  if (err.errorCode === 'ACCESS_FORBIDDEN') {
    return 'You do not have permission to perform this action'
  }

  // Not found errors
  if (err.errorCode === 'RESOURCE_NOT_FOUND') {
    return 'The requested resource was not found'
  }

  // Server errors
  if (statusCode >= 500) {
    return 'Something went wrong. Please try again later'
  }

  // Default: use original message
  return err.message || 'An error occurred'
}

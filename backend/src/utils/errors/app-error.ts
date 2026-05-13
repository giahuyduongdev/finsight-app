import { HTTPSTATUS, HttpStatusCodeType } from '../../config/http.config'
import { ErrorCodeEnumType } from '../../enums/error-code.enum'

/**
 * Base error class for all application errors
 * Extends native Error with additional properties for HTTP status and error codes
 *
 * @example
 * ```typescript
 * // Create a custom error
 * throw new AppError('User not found', HTTPSTATUS.NOT_FOUND, ErrorCodeEnum.USER_NOT_FOUND)
 *
 * // With metadata
 * throw new AppError(
 *   'Validation failed',
 *   HTTPSTATUS.BAD_REQUEST,
 *   ErrorCodeEnum.VALIDATION_ERROR,
 *   { fields: ['email', 'password'] }
 * )
 * ```
 */
export class AppError extends Error {
  public statusCode: HttpStatusCodeType
  public errorCode?: ErrorCodeEnumType
  public meta?: Record<string, unknown>

  constructor(
    message: string,
    statusCode = HTTPSTATUS.INTERNAL_SERVER_ERROR,
    errorCode?: ErrorCodeEnumType,
    meta?: Record<string, unknown>
  ) {
    super(message)
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.meta = meta
    Error.captureStackTrace(this, this.constructor)
  }
}

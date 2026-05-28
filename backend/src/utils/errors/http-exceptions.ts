import { HTTPSTATUS, HttpStatusCodeType } from '../../config/http.config'
import { ErrorCodeEnum, ErrorCodeEnumType } from '../../enums/error-code.enum'
import { AppError } from './app-error'

/**
 * Generic HTTP exception
 * Use when you need a custom HTTP status code
 */
export class HttpException extends AppError {
  constructor(
    message = 'Http Exception Error',
    statusCode: HttpStatusCodeType,
    errorCode?: ErrorCodeEnumType
  ) {
    super(message, statusCode, errorCode)
  }
}

/**
 * 404 Not Found
 * Use when a requested resource doesn't exist
 */
export class NotFoundException extends AppError {
  constructor(message = 'Resource not found', errorCode?: ErrorCodeEnumType) {
    super(
      message,
      HTTPSTATUS.NOT_FOUND,
      errorCode || ErrorCodeEnum.RESOURCE_NOT_FOUND
    )
  }
}

/**
 * 400 Bad Request
 * Use for validation errors or malformed requests
 */
export class BadRequestException extends AppError {
  constructor(
    message = 'Bad Request',
    errorCode?: ErrorCodeEnumType,
    meta?: Record<string, unknown>
  ) {
    super(
      message,
      HTTPSTATUS.BAD_REQUEST,
      errorCode || ErrorCodeEnum.VALIDATION_ERROR,
      meta
    )
  }
}

/**
 * 401 Unauthorized
 * Use when authentication is required but missing or invalid
 */
export class UnauthorizedException extends AppError {
  constructor(message = 'Unauthorized Access', errorCode?: ErrorCodeEnumType) {
    super(
      message,
      HTTPSTATUS.UNAUTHORIZED,
      errorCode || ErrorCodeEnum.ACCESS_UNAUTHORIZED
    )
  }
}

/**
 * 403 Forbidden
 * Use when user is authenticated but doesn't have permission
 */
export class ForbiddenException extends AppError {
  constructor(message = 'Forbidden Access', errorCode?: ErrorCodeEnumType) {
    super(
      message,
      HTTPSTATUS.FORBIDDEN,
      errorCode || ErrorCodeEnum.ACCESS_FORBIDDEN
    )
  }
}

/**
 * 409 Conflict
 * Use when request conflicts with current state (e.g., duplicate resource)
 */
export class ConflictException extends AppError {
  constructor(message = 'Conflict', errorCode?: ErrorCodeEnumType) {
    super(message, HTTPSTATUS.CONFLICT, errorCode)
  }
}

/**
 * 500 Internal Server Error
 * Use for unexpected server errors
 */
export class InternalServerException extends AppError {
  constructor(
    message = 'Internal Server Error',
    errorCode?: ErrorCodeEnumType
  ) {
    super(
      message,
      HTTPSTATUS.INTERNAL_SERVER_ERROR,
      errorCode || ErrorCodeEnum.INTERNAL_SERVER_ERROR
    )
  }
}

/**
 * 408 Request Timeout
 * Use when request takes too long to process
 */
export class RequestTimeoutException extends AppError {
  constructor(message = 'Request Timeout', errorCode?: ErrorCodeEnumType) {
    super(
      message,
      HTTPSTATUS.REQUEST_TIMEOUT,
      errorCode || ErrorCodeEnum.REQUEST_TIMEOUT
    )
  }
}

/**
 * 413 Payload Too Large
 * Use when request body or file upload exceeds size limit
 */
export class PayloadTooLargeException extends AppError {
  constructor(message = 'Payload Too Large', errorCode?: ErrorCodeEnumType) {
    super(
      message,
      HTTPSTATUS.PAYLOAD_TOO_LARGE,
      errorCode || ErrorCodeEnum.REQUEST_TOO_LARGE
    )
  }
}

/**
 * 415 Unsupported Media Type
 * Use when Content-Type or file type is not supported
 */
export class UnsupportedMediaTypeException extends AppError {
  constructor(
    message = 'Unsupported Media Type',
    errorCode?: ErrorCodeEnumType
  ) {
    super(
      message,
      HTTPSTATUS.UNSUPPORTED_MEDIA_TYPE,
      errorCode || ErrorCodeEnum.UNSUPPORTED_MEDIA_TYPE
    )
  }
}

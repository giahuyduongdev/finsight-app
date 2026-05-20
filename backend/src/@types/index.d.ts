import { UserDocument } from '../models/user.model'
import { Types } from 'mongoose'
import { ErrorCodeEnumType } from '../enums/error-code.enum'
import { RateLimitInfo } from 'express-rate-limit'

declare global {
  namespace Express {
    interface User extends UserDocument {
      _id?: Types.ObjectId | string
      timezone?: string
      preferredCurrency?: string
      role?: string
    }

    interface Request {
      correlationId?: string
      user?: User
      rateLimit?: RateLimitInfo
    }
  }
}

/**
 * Validation error detail for a specific field
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Standardized error response format
 * Used by error handler middleware to ensure consistent error responses across the API
 */
export interface ErrorResponse {
  error: {
    code: ErrorCodeEnumType // Machine-readable error code
    message: string // Technical error message for developers
    userMessage: string // User-friendly message for end users
    statusCode: number // HTTP status code
    requestId: string // Correlation ID for request tracking
    timestamp: string // ISO 8601 timestamp
    path: string // Request path
    method: string // HTTP method (GET, POST, etc.)
    details?: ValidationError[] // Optional validation error details
    stack?: string // Optional stack trace (only in development)
  }
}

/**
 * Pagination metadata for standardized success responses.
 */
export interface PaginationMeta {
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}

/**
 * HATEOAS pagination links for list endpoints.
 */
export interface PaginationLinks {
  self: string
  next?: string
  prev?: string
  first: string
  last: string
}

/**
 * Standardized success response format.
 */
export interface SuccessResponse<T> {
  data: T
  meta?: {
    message?: string
    pagination?: PaginationMeta
    [key: string]: unknown
  }
  links?: PaginationLinks
}

export interface HealthStatus {
  status: 'up' | 'down'
  responseTime: number
  error?: string
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: {
    mongodb: HealthStatus
    redis: HealthStatus
    bullmq: HealthStatus
  }
}

export interface ReadinessResponse {
  ready: boolean
  timestamp: string
  checks: HealthCheckResponse['checks']
}

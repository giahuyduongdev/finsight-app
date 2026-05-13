/**
 * Error utilities for the application
 *
 * This module exports all error classes used throughout the application.
 *
 * @example
 * ```typescript
 * import { NotFoundException, BadRequestException } from '@/utils/errors'
 *
 * throw new NotFoundException('User not found')
 * throw new BadRequestException('Invalid email format')
 * ```
 */

// Export base error class
export * from './app-error'

// Export all HTTP exception classes
export * from './http-exceptions'

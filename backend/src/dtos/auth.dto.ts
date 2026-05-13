/**
 * Authentication DTO Mappers
 *
 * This module provides mapper functions that transform authentication service
 * layer data into standardized Data Transfer Objects (DTOs) for API responses.
 * These mappers ensure consistent response structures across authentication
 * endpoints including login, registration, OAuth callbacks, and token refresh.
 *
 * All mappers in this module handle data sanitization by accepting pre-sanitized
 * user objects (UserResponseDTO) that have already had sensitive fields like
 * passwords removed by the service layer. The mappers focus on structuring the
 * response format and adding appropriate success messages.
 *
 * @module dtos/auth
 */

import {
  AuthSuccessResponse,
  OTPResponse,
  TokenRefreshResponse,
  UserResponseDTO
} from '../types/dto.type'

/**
 * Transform authentication result into API success response
 *
 * Creates a standardized authentication response DTO containing user profile
 * data (without password), JWT access token, token expiration timestamp, and
 * optional report settings. This mapper is used after successful login, OAuth
 * authentication, and registration verification flows.
 *
 * The user object passed to this mapper must already be sanitized (password
 * removed) by the service layer before calling this function. This mapper does
 * not perform password removal - it structures the response format only.
 *
 * @param data - Authentication result data from service layer
 * @param data.user - Sanitized user profile object with password already removed
 * @param data.accessToken - JWT access token for authenticating subsequent API requests
 * @param data.expiresAt - Token expiration timestamp in Unix epoch seconds, or undefined if not set
 * @param data.reportSetting - Optional user's report generation preferences, or null if not configured
 * @returns Formatted authentication success response with message, user data, tokens, and settings
 *
 * @example
 * ```typescript
 * const response = toAuthSuccessResponse({
 *   user: {
 *     id: '507f1f77bcf86cd799439011',
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     profilePicture: null,
 *     timezone: 'America/New_York',
 *     preferredCurrency: 'USD',
 *     role: 'USER'
 *   },
 *   accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   expiresAt: 1735776000,
 *   reportSetting: {
 *     _id: '507f1f77bcf86cd799439012',
 *     frequency: 'MONTHLY',
 *     isEnabled: true
 *   }
 * });
 * // Returns:
 * // {
 * //   message: 'Authentication successful',
 * //   user: { id: '507f...', name: 'John Doe', ... },
 * //   accessToken: 'eyJhbGc...',
 * //   expiresAt: 1735776000,
 * //   reportSetting: { _id: '507f...', frequency: 'MONTHLY', isEnabled: true }
 * // }
 * ```
 */
export const toAuthSuccessResponse = (data: {
  user: UserResponseDTO
  accessToken: string
  expiresAt: number | undefined
  reportSetting?: {
    _id: string
    frequency: string
    isEnabled: boolean
  } | null
}): AuthSuccessResponse => {
  return {
    message: 'Authentication successful',
    user: data.user,
    accessToken: data.accessToken,
    expiresAt: data.expiresAt,
    reportSetting: data.reportSetting
  }
}

/**
 * Transform OTP operation result into API response
 *
 * Creates a simple response DTO containing a confirmation message for OTP
 * (One-Time Password) operations. This mapper is used after initiating
 * registration, password reset, or email verification flows where an OTP
 * has been generated and sent to the user's email.
 *
 * The message typically confirms that an OTP was sent and provides guidance
 * on expiration time and next steps for the user.
 *
 * @param message - Confirmation message describing the OTP operation result
 * @returns OTP response DTO with the provided message
 *
 * @example
 * ```typescript
 * const response = toOTPResponse(
 *   'OTP sent to your email. Please verify within 5 minutes'
 * );
 * // Returns: { message: 'OTP sent to your email. Please verify within 5 minutes' }
 * ```
 *
 * @example
 * Password reset flow:
 * ```typescript
 * const response = toOTPResponse(
 *   'Password reset OTP sent. Check your email and enter the code to continue'
 * );
 * // Returns: { message: 'Password reset OTP sent. Check your email...' }
 * ```
 */
export const toOTPResponse = (message: string): OTPResponse => {
  return { message }
}

/**
 * Transform token refresh result into API response
 *
 * Creates a standardized token refresh response DTO containing a new JWT
 * access token and its expiration timestamp. This mapper is used after
 * successfully refreshing an expired access token using a valid refresh token.
 *
 * The response allows clients to update their stored access token and
 * continue making authenticated API requests without requiring the user
 * to log in again.
 *
 * @param data - Token refresh result data from service layer
 * @param data.accessToken - New JWT access token for authenticating API requests
 * @param data.expiresAt - New token expiration timestamp in Unix epoch seconds, or undefined if not set
 * @returns Formatted token refresh response with success message and new token data
 *
 * @example
 * ```typescript
 * const response = toTokenRefreshResponse({
 *   accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   expiresAt: 1735776000
 * });
 * // Returns:
 * // {
 * //   message: 'Token refreshed successfully',
 * //   accessToken: 'eyJhbGc...',
 * //   expiresAt: 1735776000
 * // }
 * ```
 */
export const toTokenRefreshResponse = (data: {
  accessToken: string
  expiresAt: number | undefined
}): TokenRefreshResponse => {
  return {
    message: 'Token refreshed successfully',
    accessToken: data.accessToken,
    expiresAt: data.expiresAt
  }
}

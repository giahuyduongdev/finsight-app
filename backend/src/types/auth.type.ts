/**
 * Authentication Type Definitions
 *
 * This module defines TypeScript interfaces and types for authentication-related
 * data structures including JWT tokens, OAuth flows, OTP verification, and user
 * session management. These types ensure type safety across authentication services,
 * controllers, and API responses.
 *
 * @module types/auth
 */

import { UserWithoutPassword } from './user.type'

/**
 * JWT Token Payload
 *
 * Official Documentation @ https://tools.ietf.org/html/rfc7519
 *
 * Payload structure for JWT access and refresh tokens. Contains user identification
 * and standard JWT claims as defined in RFC 7519. The `iat` (issued at) and `exp`
 * (expiration) claims are automatically set by the JWT library during token generation.
 *
 * @property userId - MongoDB ObjectId of the authenticated user as a string
 * @property iat - Issued at timestamp in Unix epoch seconds (set by JWT library)
 * @property exp - Expiration timestamp in Unix epoch seconds (set by JWT library)
 *
 * @example
 * ```typescript
 * const payload: JWTPayload = {
 *   userId: '507f1f77bcf86cd799439011',
 *   iat: 1735689600,
 *   exp: 1735776000
 * };
 * ```
 */
export interface JWTPayload {
  userId: string
  iat?: number
  exp?: number
}

/**
 * Token Pair
 *
 * Official Documentation @ https://tools.ietf.org/html/rfc6749#section-1.5
 *
 * Contains both access and refresh tokens issued during authentication flows.
 * The access token is used for API requests, while the refresh token is used
 * to obtain new access tokens when they expire. Follows OAuth 2.0 token patterns.
 *
 * @property accessToken - JWT access token for authenticating API requests
 * @property refreshToken - JWT refresh token for obtaining new access tokens
 * @property expiresAt - Access token expiration timestamp in Unix epoch seconds
 *
 * @example
 * ```typescript
 * const tokens: TokenPair = {
 *   accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   expiresAt: 1735776000
 * };
 * ```
 */
export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Login Response
 *
 * Complete authentication response returned after successful login via email/password
 * or OAuth flows. Contains user profile data (without sensitive fields), authentication
 * tokens, and optional report settings for the user's dashboard preferences.
 *
 * @property user - User profile data with password and sensitive methods removed
 * @property accessToken - JWT access token for authenticating subsequent API requests
 * @property refreshToken - JWT refresh token for obtaining new access tokens
 * @property expiresAt - Access token expiration timestamp in Unix epoch seconds, or undefined if not set
 * @property reportSetting - User's report generation preferences (frequency, enabled status), or null if not configured
 *
 * @example
 * ```typescript
 * const response: LoginResponse = {
 *   user: {
 *     _id: '507f1f77bcf86cd799439011',
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     timezone: 'America/New_York',
 *     preferredCurrency: 'USD',
 *     role: 'USER'
 *   },
 *   accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   expiresAt: 1735776000,
 *   reportSetting: {
 *     _id: '507f1f77bcf86cd799439012',
 *     frequency: 'MONTHLY',
 *     isEnabled: true
 *   }
 * };
 * ```
 */
export interface LoginResponse {
  user: UserWithoutPassword
  accessToken: string
  refreshToken: string
  expiresAt: number | undefined
  reportSetting?: {
    _id: string
    frequency: string
    isEnabled: boolean
  } | null
}

/**
 * Register Response
 *
 * Response returned after successful user registration and OTP verification.
 * Contains the newly created user profile data without sensitive fields.
 * This response is returned by the OTP verification endpoint after the user
 * confirms their email address.
 *
 * @property user - Newly created user profile with password and sensitive methods removed
 *
 * @example
 * ```typescript
 * const response: RegisterResponse = {
 *   user: {
 *     _id: '507f1f77bcf86cd799439011',
 *     name: 'Jane Smith',
 *     email: 'jane@example.com',
 *     timezone: 'UTC',
 *     preferredCurrency: 'USD',
 *     role: 'USER',
 *     createdAt: new Date('2024-01-01'),
 *     updatedAt: new Date('2024-01-01')
 *   }
 * };
 * ```
 */
export interface RegisterResponse {
  user: UserWithoutPassword
}

/**
 * OTP Verification Result
 *
 * Result returned after OTP (One-Time Password) verification for various flows
 * including registration, password reset, and email verification. The structure
 * varies based on the verification context:
 *
 * - Registration: includes user data after successful account creation
 * - Password reset: includes resetToken for password change authorization
 * - Generic verification: includes only a success message
 *
 * @property message - Human-readable success or status message
 * @property user - User profile data (present after registration verification)
 * @property resetToken - Temporary token for password reset authorization (present after forgot password verification)
 *
 * @example
 * Registration verification:
 * ```typescript
 * const result: OTPVerificationResult = {
 *   message: 'Email verified successfully. Account created.',
 *   user: {
 *     _id: '507f1f77bcf86cd799439011',
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     timezone: 'UTC',
 *     preferredCurrency: 'USD',
 *     role: 'USER'
 *   }
 * };
 * ```
 *
 * @example
 * Password reset verification:
 * ```typescript
 * const result: OTPVerificationResult = {
 *   message: 'OTP verified. You can now reset your password.',
 *   resetToken: 'temp_reset_token_abc123'
 * };
 * ```
 */
export interface OTPVerificationResult {
  message: string
  user?: UserWithoutPassword
  resetToken?: string
}

/**
 * OAuth Callback Result
 *
 * Official Documentation @ https://tools.ietf.org/html/rfc6749#section-4.1
 *
 * Data returned after successful OAuth 2.0 authorization code flow with external
 * identity providers (e.g., Auth0, Google, GitHub). Contains authentication tokens
 * and user profile information for client-side storage and subsequent API requests.
 *
 * This result is generated after exchanging the authorization code for tokens and
 * fetching the user profile from the OAuth provider. If the user doesn't exist in
 * the system, a new account is created and linked to the OAuth provider identity.
 *
 * @property accessToken - JWT access token for authenticating API requests
 * @property expiresAt - Access token expiration timestamp in Unix epoch seconds, or undefined if not set
 * @property refreshToken - JWT refresh token for obtaining new access tokens
 * @property user - User profile data with password and sensitive methods removed
 *
 * @example
 * ```typescript
 * const result: OAuthCallbackResult = {
 *   accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   expiresAt: 1735776000,
 *   refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   user: {
 *     _id: '507f1f77bcf86cd799439011',
 *     name: 'Alice Johnson',
 *     email: 'alice@example.com',
 *     profilePicture: 'https://example.com/avatar.jpg',
 *     timezone: 'America/Los_Angeles',
 *     preferredCurrency: 'USD',
 *     role: 'USER',
 *     auth0Ids: ['auth0|507f1f77bcf86cd799439011']
 *   }
 * };
 * ```
 */
export interface OAuthCallbackResult {
  accessToken: string
  expiresAt: number | undefined
  refreshToken: string
  user: UserWithoutPassword
}

/**
 * Auth0 Profile Data
 *
 * Official Documentation @ https://auth0.com/docs/api/authentication#user-profile
 *
 * User profile information returned from Auth0's `/userinfo` endpoint after
 * successful OAuth authentication. Contains basic user identity data from the
 * OAuth provider. The `sub` (subject) field is the unique identifier for the
 * user within the Auth0 system and is stored in the user's `auth0Ids` array
 * for account linking.
 *
 * @property email - User's email address from the OAuth provider
 * @property name - User's full name from the OAuth provider
 * @property picture - URL to user's profile picture from the OAuth provider
 * @property sub - Auth0 subject identifier (format: "provider|id", e.g., "auth0|507f1f77bcf86cd799439011")
 *
 * @example
 * ```typescript
 * const profile: Auth0Profile = {
 *   email: 'user@example.com',
 *   name: 'John Doe',
 *   picture: 'https://s.gravatar.com/avatar/abc123.png',
 *   sub: 'auth0|507f1f77bcf86cd799439011'
 * };
 * ```
 */
export interface Auth0Profile {
  email: string
  name: string
  picture: string
  sub: string
}

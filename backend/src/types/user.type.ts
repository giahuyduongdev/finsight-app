/**
 * User Type Definitions Module
 *
 * This module provides TypeScript type definitions for user-related data structures
 * used throughout the application. These types ensure type safety when working with
 * user data in services, controllers, and API responses.
 *
 * The types in this module are derived from the User model but exclude sensitive
 * fields (like passwords) and internal methods to create safe data transfer objects
 * suitable for client-side consumption.
 *
 * @module types/user
 */

import { UserDocument } from '../models/user.model'

/**
 * User object without sensitive authentication fields
 *
 * This type represents a sanitized user object safe for API responses and client-side
 * data transfer. It omits the password field and the comparePassword method to prevent
 * accidental exposure of sensitive authentication data.
 *
 * The resulting type includes all user profile information:
 * - `_id`: User's unique identifier
 * - `name`: User's full name
 * - `email`: User's email address
 * - `profilePicture`: URL to profile image or null
 * - `timezone`: IANA timezone identifier (e.g., 'America/New_York', 'UTC')
 * - `preferredCurrency`: ISO 4217 currency code (e.g., 'USD', 'EUR')
 * - `role`: User role (USER or ADMIN)
 * - `auth0Ids`: Array of Auth0 identity provider IDs (optional)
 * - `createdAt`: Account creation timestamp
 * - `updatedAt`: Last modification timestamp
 * - `omitPassword`: Method to remove password from user object
 *
 * @example
 * ```typescript
 * // Service layer usage
 * const user: UserWithoutPassword = await userModel.findById(userId).select('-password');
 *
 * // API response
 * res.json({
 *   success: true,
 *   data: user as UserWithoutPassword
 * });
 * ```
 *
 * @see {@link UserDocument} for the complete user document interface with password
 */
export type UserWithoutPassword = Omit<
  UserDocument,
  'password' | 'comparePassword'
>

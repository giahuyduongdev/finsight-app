/**
 * Data Transfer Object (DTO) Type Definitions
 *
 * This module defines TypeScript interfaces for Data Transfer Objects (DTOs)
 * used in API request and response payloads. DTOs shape data for external
 * communication, ensuring consistent API contracts and separating internal
 * domain models from external representations.
 *
 * All DTOs in this module represent response structures returned by API
 * endpoints. They exclude sensitive fields (like passwords) and format
 * data appropriately for client consumption.
 */

import { PaginationMeta } from './api-response.type'

/**
 * User Response DTO
 *
 * Represents user profile data in API responses. This DTO excludes
 * sensitive fields like password and internal authentication tokens.
 * Used across authentication, user management, and profile endpoints.
 *
 * @property id - Unique user identifier (MongoDB ObjectId as string)
 * @property name - User's full name
 * @property email - User's email address (unique, lowercase)
 * @property profilePicture - URL to user's profile image, or null if not set
 * @property timezone - IANA timezone identifier (e.g., 'America/New_York', 'UTC')
 * @property preferredCurrency - ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP')
 * @property role - User role identifier (e.g., 'USER', 'ADMIN')
 */
export interface CurrentUserDTO {
  id: string
  name: string
  email: string
  profilePicture: string | null
  timezone: string
  preferredCurrency: string
  role: string
}

export type AuthUserDTO = CurrentUserDTO

export interface PublicUserDTO {
  id: string
  name: string
  profilePicture: string | null
}

export type UserResponseDTO = CurrentUserDTO

/**
 * Transaction Response DTO
 *
 * Represents a financial transaction in API responses. Contains complete
 * transaction details including amount, category, status, and metadata.
 * Used by transaction listing, creation, and update endpoints.
 *
 * @property _id - Unique transaction identifier (MongoDB ObjectId as string)
 * @property userId - ID of the user who owns this transaction
 * @property title - Brief description or title of the transaction
 * @property type - Transaction type: 'INCOME' for money received, 'EXPENSE' for money spent
 * @property amount - Transaction amount as a positive number (currency determined by currency field)
 * @property currency - ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP')
 * @property category - Transaction category name (e.g., 'Food', 'Transportation', 'Salary')
 * @property date - Date when the transaction occurred
 * @property description - Optional detailed description or notes about the transaction
 * @property isRecurring - Whether this transaction repeats on a schedule
 * @property recurringInterval - Optional recurrence pattern (e.g., 'DAILY', 'WEEKLY', 'MONTHLY'), only present if isRecurring is true
 * @property status - Transaction processing status: 'COMPLETED' (processed), 'PENDING' (awaiting processing), 'FAILED' (processing failed)
 * @property paymentMethod - Payment method used (e.g., 'CASH', 'CREDIT_CARD', 'BANK_TRANSFER')
 * @property receiptUrl - Optional URL to uploaded receipt image or document
 * @property createdAt - Timestamp when the transaction record was created
 * @property updatedAt - Timestamp when the transaction record was last modified
 */
export interface TransactionResponseDTO {
  _id: string
  userId: string
  title: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  currency: string
  category: string
  date: Date
  description?: string
  isRecurring: boolean
  recurringInterval?: string
  status: 'COMPLETED' | 'PENDING' | 'FAILED'
  paymentMethod: string
  receiptUrl?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Paginated Transaction Response
 *
 * Represents a paginated list of transactions with metadata. Used by
 * transaction listing endpoints that support pagination for large datasets.
 *
 * @property message - Success message describing the response
 * @property transactions - Array of transaction DTOs for the current page
 * @property pagination - Pagination metadata including total count, page info, and navigation links
 */
export interface PaginatedTransactionsResponse {
  message: string
  transactions: TransactionResponseDTO[]
  pagination: PaginationMeta
}

/**
 * Authentication Success Response
 *
 * Returned after successful authentication operations (login, registration
 * verification, OAuth callback). Contains user profile, access token for
 * API requests, and optional report settings.
 *
 * @property message - Success message describing the authentication result
 * @property user - User profile data without sensitive fields
 * @property accessToken - JWT access token for authenticating subsequent API requests
 * @property expiresAt - Token expiration timestamp (Unix epoch in seconds), or undefined if not set
 * @property reportSetting - Optional user's report preferences, or null if not configured
 */
export interface AuthSuccessResponse {
  message: string
  user: AuthUserDTO
  accessToken: string
  expiresAt: number | undefined
  reportSetting?: {
    _id: string
    frequency: string
    isEnabled: boolean
  } | null
}

/**
 * OTP Response
 *
 * Returned after OTP (One-Time Password) operations such as registration
 * initiation or password reset requests. Confirms that an OTP has been
 * sent to the user's email.
 *
 * @property message - Confirmation message indicating OTP was sent successfully
 */
export interface OTPResponse {
  message: string
}

/**
 * Token Refresh Response
 *
 * Returned after successfully refreshing an expired access token using
 * a valid refresh token. Contains a new access token and its expiration.
 *
 * @property message - Success message confirming token refresh
 * @property accessToken - New JWT access token for API requests
 * @property refreshToken - New JWT refresh token for future refresh requests, omitted for grace duplicate responses
 * @property expiresAt - New token expiration timestamp (Unix epoch in seconds), or undefined if not set
 */
export interface TokenRefreshResponse {
  message: string
  accessToken: string
  refreshToken?: string
  expiresAt: number | undefined
}

/**
 * Report Setting Response
 *
 * Returned when retrieving or updating user's report preferences.
 * Contains configuration for automated financial report generation
 * and delivery schedule.
 *
 * @property message - Success message describing the operation result
 * @property data - Report setting configuration object
 */
export interface ReportSettingResponse {
  message: string
  data: {
    /**
     * Unique report setting identifier (MongoDB ObjectId as string)
     */
    _id: string
    /**
     * ID of the user who owns this report setting
     */
    userId: string
    /**
     * Report generation frequency (e.g., 'DAILY', 'WEEKLY', 'MONTHLY')
     */
    frequency: string
    /**
     * Whether automated report generation is enabled
     */
    isEnabled: boolean
    /**
     * Timestamp when the last report was sent, or null if never sent
     */
    lastSentDate: Date | null
    /**
     * Timestamp when the next report is scheduled to be sent, or null if not scheduled
     */
    nextReportDate: Date | null
  }
}

/**
 * Generate Report Response
 *
 * Returned after generating a financial report. Contains aggregated
 * financial data, insights, and analysis for the specified period.
 *
 * @property message - Success message confirming report generation
 * @property period - Human-readable description of the report period (e.g., 'January 2024', 'Q1 2024')
 * @property summary - Aggregated financial metrics for the period
 * @property currency - ISO 4217 currency code used for all monetary values in the report
 * @property insights - Array of AI-generated or rule-based insights about spending patterns and trends
 */
export interface GenerateReportResponse {
  message: string
  period: string
  summary: {
    /**
     * Total income for the period
     */
    income: number
    /**
     * Total expenses for the period
     */
    expenses: number
    /**
     * Net balance (income minus expenses)
     */
    balance: number
    /**
     * Savings rate as a percentage (0-100)
     */
    savingsRate: number
    /**
     * Top spending categories ranked by amount
     */
    topCategories: Array<{
      /**
       * Category name
       */
      name: string
      /**
       * Total amount spent in this category
       */
      amount: number
      /**
       * Percentage of total expenses (0-100)
       */
      percent: number
    }>
  }
  currency: string
  insights: string[]
}

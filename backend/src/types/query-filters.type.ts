/**
 * Query Filter Type Definitions
 *
 * This module defines common filter types used across different API endpoints
 * for querying, filtering, and paginating data. These types standardize query
 * parameters for date ranges, pagination, transaction filters, and other
 * common filtering patterns used throughout the application.
 *
 * @module types/query-filters
 */

import { DateRangePreset } from '../enums/date-range.enum'
import { TransactionTypeEnum } from '../models/transaction.model'
import { CurrencyType } from '../enums/currency.enum'

/**
 * Date Range Query Parameters
 *
 * Flexible date range specification for API queries. Supports both preset
 * ranges (e.g., "THIS_MONTH", "LAST_YEAR") and custom date ranges with
 * explicit from/to dates. The timezone parameter ensures date boundaries
 * are calculated correctly for the user's local time.
 *
 * @property preset - Predefined date range option from DateRangePreset enum
 * @property from - Start date as ISO 8601 string (e.g., "2024-01-01")
 * @property to - End date as ISO 8601 string (e.g., "2024-01-31")
 * @property timezone - IANA timezone identifier (e.g., "America/New_York", "UTC")
 *
 * @example
 * Using preset:
 * ```typescript
 * const query: DateRangeQuery = {
 *   preset: DateRangePreset.THIS_MONTH,
 *   timezone: 'America/New_York'
 * };
 * ```
 *
 * @example
 * Using custom range:
 * ```typescript
 * const query: DateRangeQuery = {
 *   from: '2024-01-01',
 *   to: '2024-01-31',
 *   timezone: 'UTC'
 * };
 * ```
 */
export interface DateRangeQuery {
  preset?: DateRangePreset
  from?: string
  to?: string
  timezone?: string
}

/**
 * Common Pagination Query Parameters
 *
 * Standard pagination parameters extracted from HTTP request query strings.
 * These parameters control the page size and page number for paginated API
 * responses. Values can be strings (from query params) or numbers (after parsing).
 *
 * @property pageSize - Number of items per page (default varies by endpoint, typically 10-50)
 * @property pageNumber - Page number to retrieve (1-indexed, first page is 1)
 *
 * @example
 * From query string:
 * ```typescript
 * // GET /api/v1/transactions?pageSize=20&pageNumber=2
 * const query: PaginationQuery = {
 *   pageSize: '20',
 *   pageNumber: '2'
 * };
 * ```
 *
 * @example
 * After parsing:
 * ```typescript
 * const query: PaginationQuery = {
 *   pageSize: 20,
 *   pageNumber: 2
 * };
 * ```
 */
export interface PaginationQuery {
  pageSize?: string | number
  pageNumber?: string | number
}

/**
 * Transaction Status Enum
 *
 * Represents the processing status of a transaction. Transactions can be
 * completed (finalized), pending (awaiting confirmation), or failed (rejected
 * or unsuccessful). This status affects how transactions are displayed and
 * included in financial calculations.
 *
 * - COMPLETED: Transaction has been finalized and included in balance calculations
 * - PENDING: Transaction is awaiting confirmation or processing
 * - FAILED: Transaction was rejected or unsuccessful
 */
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FAILED'

/**
 * Recurring Status Enum
 *
 * Indicates whether a transaction is part of a recurring pattern or a one-time
 * transaction. Recurring transactions repeat on a regular schedule (e.g., monthly
 * subscriptions, weekly allowances), while non-recurring transactions are one-time
 * events.
 *
 * - RECURRING: Transaction repeats on a regular schedule
 * - NON_RECURRING: One-time transaction with no repetition
 */
export type RecurringStatus = 'RECURRING' | 'NON_RECURRING'

/**
 * Transaction Filter Query Parameters
 *
 * Comprehensive filter parameters for transaction queries. Supports filtering
 * by keyword search, transaction type, recurring status, currency, processing
 * status, and date ranges. All filters are optional and can be combined for
 * precise transaction queries.
 *
 * @property keyword - Search term for transaction description, category, or notes
 * @property type - Transaction type filter (INCOME or EXPENSE)
 * @property recurringStatus - Filter by recurring pattern (RECURRING or NON_RECURRING)
 * @property currency - ISO 4217 currency code filter (e.g., "USD", "EUR")
 * @property status - Processing status filter (COMPLETED, PENDING, or FAILED)
 * @property dateRangePreset - Predefined date range option from DateRangePreset enum
 * @property from - Start date as ISO 8601 string for custom date range
 * @property to - End date as ISO 8601 string for custom date range
 * @property timezone - IANA timezone identifier for date boundary calculations
 *
 * @example
 * Search with multiple filters:
 * ```typescript
 * const filters: TransactionFilterQuery = {
 *   keyword: 'grocery',
 *   type: 'EXPENSE',
 *   currency: 'USD',
 *   status: 'COMPLETED',
 *   dateRangePreset: DateRangePreset.THIS_MONTH,
 *   timezone: 'America/New_York'
 * };
 * ```
 *
 * @example
 * Custom date range with recurring filter:
 * ```typescript
 * const filters: TransactionFilterQuery = {
 *   recurringStatus: 'RECURRING',
 *   from: '2024-01-01',
 *   to: '2024-12-31',
 *   timezone: 'UTC'
 * };
 * ```
 */
export interface TransactionFilterQuery {
  keyword?: string
  type?: keyof typeof TransactionTypeEnum
  recurringStatus?: RecurringStatus
  currency?: CurrencyType
  status?: TransactionStatus
  dateRangePreset?: DateRangePreset
  from?: string
  to?: string
  timezone?: string
  importBatchId?: string
}

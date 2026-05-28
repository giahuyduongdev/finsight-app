/**
 * Repository Type Definitions
 *
 * This module defines common types used across all repository classes for
 * pagination, filtering, and query results. These types standardize data
 * access patterns and ensure consistent pagination and filtering behavior
 * across different data models.
 *
 * @module types/repository
 */

// ─── Pagination Types ─────────────────────────────────────────────────────────

/**
 * Parameters for Paginated Queries
 *
 * Standard pagination parameters used by repository methods to control
 * the number of results returned and which page to retrieve. Page numbers
 * are 1-indexed (first page is 1).
 *
 * @property pageSize - Number of items to return per page (typically 10-100)
 * @property pageNumber - Page number to retrieve (1-indexed, first page is 1)
 *
 * @example
 * ```typescript
 * const params: PaginationParams = {
 *   pageSize: 20,
 *   pageNumber: 2  // Retrieve second page
 * };
 * ```
 */
export interface PaginationParams {
  pageSize: number
  pageNumber: number
}

/**
 * Metadata Returned with Paginated Results
 *
 * Comprehensive pagination metadata included with every paginated query result.
 * Provides all information needed for clients to implement pagination controls,
 * calculate page ranges, and understand the total dataset size.
 *
 * @property pageSize - Number of items per page (as requested)
 * @property pageNumber - Current page number (1-indexed)
 * @property totalCount - Total number of items across all pages
 * @property totalPages - Total number of pages (calculated from totalCount and pageSize)
 * @property skip - Number of items skipped to reach this page (for database queries)
 *
 * @example
 * ```typescript
 * const metadata: PaginationMetadata = {
 *   pageSize: 20,
 *   pageNumber: 2,
 *   totalCount: 157,
 *   totalPages: 8,
 *   skip: 20  // (pageNumber - 1) * pageSize
 * };
 * ```
 */
export interface PaginationMetadata {
  pageSize: number
  pageNumber: number
  totalCount: number
  totalPages: number
  skip: number
}

/**
 * Generic Paginated Result Wrapper
 *
 * Standard wrapper for paginated query results. Combines the data array
 * with pagination metadata, providing a consistent structure for all
 * paginated API responses and repository methods.
 *
 * @template T - Type of items in the data array
 * @property data - Array of items for the current page
 * @property pagination - Pagination metadata for navigation and display
 *
 * @example
 * ```typescript
 * const result: PaginatedResult<Transaction> = {
 *   data: [
 *     { _id: '1', description: 'Grocery', amount: 50, type: 'EXPENSE' },
 *     { _id: '2', description: 'Salary', amount: 5000, type: 'INCOME' }
 *   ],
 *   pagination: {
 *     pageSize: 20,
 *     pageNumber: 1,
 *     totalCount: 157,
 *     totalPages: 8,
 *     skip: 0
 *   }
 * };
 * ```
 */
export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationMetadata
}

// ─── Transaction Filter Types ─────────────────────────────────────────────────

/**
 * Filter Parameters for Transaction Queries
 *
 * Comprehensive filter options for querying transactions in repository methods.
 * All filters are optional and can be combined for precise transaction queries.
 * Supports keyword search, type filtering, recurring status, currency, processing
 * status, and date range filtering with timezone support.
 *
 * @property keyword - Search term for transaction description, category, or notes
 * @property type - Transaction type filter (INCOME or EXPENSE)
 * @property recurringStatus - Filter by recurring pattern (RECURRING or NON_RECURRING)
 * @property currency - ISO 4217 currency code filter (e.g., "USD", "EUR")
 * @property status - Processing status filter (COMPLETED, PENDING, or FAILED)
 * @property dateRangePreset - Predefined date range option (e.g., "THIS_MONTH")
 * @property from - Start date as ISO 8601 string or Date object
 * @property to - End date as ISO 8601 string or Date object
 * @property timezone - IANA timezone identifier for date boundary calculations
 *
 * @example
 * ```typescript
 * const filters: TransactionFilters = {
 *   keyword: 'grocery',
 *   type: 'EXPENSE',
 *   currency: 'USD',
 *   status: 'COMPLETED',
 *   from: '2024-01-01',
 *   to: '2024-01-31',
 *   timezone: 'America/New_York'
 * };
 * ```
 */
export interface TransactionFilters {
  keyword?: string
  type?: 'INCOME' | 'EXPENSE'
  recurringStatus?: 'RECURRING' | 'NON_RECURRING'
  currency?: string
  status?: 'COMPLETED' | 'PENDING' | 'FAILED'
  dateRangePreset?: string
  from?: string | Date
  to?: string | Date
  timezone?: string
}

// ─── Delete Result Types ──────────────────────────────────────────────────────

/**
 * Result of Delete Operations
 *
 * Standard result structure returned by repository delete methods. Indicates
 * how many documents were successfully deleted from the database. A deletedCount
 * of 0 means no matching documents were found or deleted.
 *
 * @property deletedCount - Number of documents successfully deleted
 *
 * @example
 * ```typescript
 * const result: DeleteResult = {
 *   deletedCount: 3  // 3 documents were deleted
 * };
 * ```
 */
export interface DeleteResult {
  deletedCount: number
}

/**
 * Result of Bulk Insert Operations
 *
 * Standard result structure returned by repository bulk insert methods.
 * Indicates how many documents were successfully inserted into the database.
 * Used for batch operations like bulk transaction imports.
 *
 * @property insertedCount - Number of documents successfully inserted
 *
 * @example
 * ```typescript
 * const result: BulkInsertResult = {
 *   insertedCount: 150  // 150 documents were inserted
 * };
 * ```
 */
export interface BulkInsertResult {
  insertedCount: number
}

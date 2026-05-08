/**
 * Repository Type Definitions
 * Common types used across all repositories for pagination, filtering, and query results
 */

// ─── Pagination Types ─────────────────────────────────────────────────────────

/**
 * Parameters for paginated queries
 */
export interface PaginationParams {
  pageSize: number
  pageNumber: number
}

/**
 * Metadata returned with paginated results
 */
export interface PaginationMetadata {
  pageSize: number
  pageNumber: number
  totalCount: number
  totalPages: number
  skip: number
}

/**
 * Generic paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationMetadata
}

// ─── Transaction Filter Types ─────────────────────────────────────────────────

/**
 * Filter parameters for transaction queries
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
 * Result of delete operations
 */
export interface DeleteResult {
  deletedCount: number
}

/**
 * Result of bulk insert operations
 */
export interface BulkInsertResult {
  insertedCount: number
}

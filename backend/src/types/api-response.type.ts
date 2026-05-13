/**
 * API Response Type Definitions
 *
 * This module defines standardized response structures for all API endpoints.
 * These types ensure consistent response formats across the application, making
 * it easier for clients to parse and handle API responses predictably.
 *
 * The response types follow REST API best practices and include support for:
 * - Standard success responses with optional data payloads
 * - Paginated responses for list endpoints
 * - Bulk operation results for batch operations
 * - Async job status tracking for long-running operations
 *
 * All response types conform to HTTP standards as defined in RFC 7231.
 * Official Documentation @ https://tools.ietf.org/html/rfc7231
 */

/**
 * Pagination Metadata
 *
 * Contains pagination information for list endpoints. This metadata allows
 * clients to navigate through paginated results and understand the total
 * dataset size without fetching all records.
 *
 * Note: This type is for API responses. Use PaginationMetadata from
 * repository.types for internal repository operations.
 *
 * @property pageSize - Number of items per page (maximum items in current response)
 * @property pageNumber - Current page number (1-indexed)
 * @property totalPages - Total number of pages available
 * @property totalItems - Total number of items across all pages
 * @property hasNextPage - Whether there is a next page available
 * @property hasPrevPage - Whether there is a previous page available
 *
 * @example
 * ```typescript
 * const pagination: PaginationMeta = {
 *   pageSize: 20,
 *   pageNumber: 2,
 *   totalPages: 5,
 *   totalItems: 95,
 *   hasNextPage: true,
 *   hasPrevPage: true
 * };
 * ```
 */
export interface PaginationMeta {
  pageSize: number
  pageNumber: number
  totalPages: number
  totalItems: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * Standard Success Response
 *
 * Generic response structure for successful API operations. This type provides
 * a consistent format for all success responses, with an optional data payload
 * for operations that return data.
 *
 * Used for operations that complete successfully and may or may not return data,
 * such as create, update, delete, or retrieve operations.
 *
 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3
 *
 * @template T - Type of the data payload (defaults to unknown)
 *
 * @property message - Human-readable success message describing the operation result
 * @property data - Optional data payload containing the operation result
 *
 * @example
 * Success response with data:
 * ```typescript
 * const response: SuccessResponse<User> = {
 *   message: 'User retrieved successfully',
 *   data: { id: '123', name: 'John Doe', email: 'john@example.com' }
 * };
 * ```
 *
 * @example
 * Success response without data:
 * ```typescript
 * const response: SuccessResponse = {
 *   message: 'User deleted successfully'
 * };
 * ```
 */
export interface SuccessResponse<T = unknown> {
  message: string
  data?: T
}

/**
 * Paginated Response
 *
 * Response structure for list endpoints that support pagination. Combines
 * the data array with pagination metadata to provide complete information
 * about the paginated dataset.
 *
 * This type is used for all list endpoints that return multiple items,
 * such as transaction lists, user lists, or report lists.
 *
 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.1
 *
 * @template T - Type of items in the data array
 *
 * @property message - Human-readable message describing the result
 * @property data - Array of items for the current page
 * @property pagination - Pagination metadata for navigation
 *
 * @example
 * ```typescript
 * const response: PaginatedResponse<Transaction> = {
 *   message: 'Transactions retrieved successfully',
 *   data: [
 *     { id: '1', amount: 100, description: 'Groceries' },
 *     { id: '2', amount: 50, description: 'Gas' }
 *   ],
 *   pagination: {
 *     pageSize: 20,
 *     pageNumber: 1,
 *     totalPages: 3,
 *     totalItems: 45,
 *     hasNextPage: true,
 *     hasPrevPage: false
 *   }
 * };
 * ```
 */
export interface PaginatedResponse<T> {
  message: string
  data: T[]
  pagination: PaginationMeta
}

/**
 * Bulk Operation Result
 *
 * Response structure for bulk operations that modify multiple records.
 * Provides detailed statistics about the operation's impact, including
 * counts of affected records.
 *
 * Used for batch operations such as bulk delete, bulk update, or bulk
 * import operations. The optional count fields allow the response to
 * indicate which type of operation was performed.
 *
 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.1
 *
 * @property success - Whether the bulk operation completed successfully
 * @property deletedCount - Number of records deleted (for delete operations)
 * @property insertedCount - Number of records inserted (for create operations)
 * @property modifiedCount - Number of records modified (for update operations)
 * @property message - Optional human-readable message with operation details
 *
 * @example
 * Bulk delete result:
 * ```typescript
 * const result: BulkOperationResult = {
 *   success: true,
 *   deletedCount: 15,
 *   message: '15 transactions deleted successfully'
 * };
 * ```
 *
 * @example
 * Bulk import result:
 * ```typescript
 * const result: BulkOperationResult = {
 *   success: true,
 *   insertedCount: 42,
 *   modifiedCount: 8,
 *   message: '42 new transactions imported, 8 existing transactions updated'
 * };
 * ```
 */
export interface BulkOperationResult {
  success: boolean
  deletedCount?: number
  insertedCount?: number
  modifiedCount?: number
  message?: string
}

/**
 * Job Status Response
 *
 * Response structure for asynchronous operations that are processed in the
 * background. Provides job tracking information so clients can poll for
 * completion status or display progress to users.
 *
 * Used for long-running operations such as report generation, bulk imports,
 * or data processing tasks that are handled by background job queues.
 *
 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.3
 * The 202 Accepted status code is typically used with this response type.
 *
 * @property message - Human-readable message describing the job status
 * @property jobId - Unique identifier for the background job
 * @property batchId - Optional batch identifier for grouped operations
 * @property status - Current job status (pending, processing, completed, or failed)
 *
 * @example
 * Job accepted response:
 * ```typescript
 * const response: JobStatusResponse = {
 *   message: 'Report generation started',
 *   jobId: 'job_abc123',
 *   status: 'pending'
 * };
 * ```
 *
 * @example
 * Batch job status:
 * ```typescript
 * const response: JobStatusResponse = {
 *   message: 'Bulk import in progress',
 *   jobId: 'job_xyz789',
 *   batchId: 'batch_2024_01',
 *   status: 'processing'
 * };
 * ```
 */
export interface JobStatusResponse {
  message: string
  jobId: string
  batchId?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
}

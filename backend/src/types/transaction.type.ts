/**
 * Transaction Type Definitions
 *
 * This module defines TypeScript interfaces and types for transaction operations
 * including bulk imports and batch processing. These types support transaction
 * creation, bulk data imports, and transaction processing workflows.
 *
 * @module types/transaction
 */

import { CreateTransactionType } from '../validators/transaction.validator'

/**
 * Bulk Transaction Item for Import Operations
 *
 * Transaction data structure used in bulk import and batch processing operations.
 * Extends the standard CreateTransactionType with required status field and
 * optional backfill flag. The status field is mandatory for bulk imports to
 * ensure proper transaction state tracking.
 *
 * This type omits the 'status' and 'backfill' fields from CreateTransactionType
 * and redefines them with specific constraints for bulk operations.
 *
 * @property status - Processing status (COMPLETED, PENDING, or FAILED) - required for bulk imports
 * @property backfill - Flag indicating if this is a historical backfill transaction (optional)
 *
 * @example
 * ```typescript
 * const bulkItem: BulkTransactionItem = {
 *   description: 'Grocery Shopping',
 *   amount: 125.50,
 *   type: 'EXPENSE',
 *   category: 'Food & Dining',
 *   date: new Date('2024-01-15'),
 *   currency: 'USD',
 *   status: 'COMPLETED',
 *   backfill: true  // Historical transaction
 * };
 * ```
 */
export type BulkTransactionItem = Omit<
  CreateTransactionType,
  'status' | 'backfill'
> & {
  status: 'COMPLETED' | 'PENDING' | 'FAILED'
  backfill?: boolean
}

/**
 * Result of Bulk Import Operation
 *
 * Comprehensive result structure returned after bulk transaction import operations.
 * Provides detailed statistics about the import process including successful
 * insertions, rejections, and total items processed. Used for reporting import
 * success and identifying issues.
 *
 * @property insertedCount - Number of transactions successfully inserted into the database
 * @property rejectedCount - Number of transactions rejected due to validation errors (optional)
 * @property totalProcessed - Total number of transactions processed in the import (optional)
 * @property message - Human-readable status message or error description (optional)
 *
 * @example
 * Successful import:
 * ```typescript
 * const result: BulkImportResult = {
 *   insertedCount: 145,
 *   rejectedCount: 5,
 *   totalProcessed: 150,
 *   message: 'Bulk import completed successfully'
 * };
 * ```
 *
 * @example
 * Partial failure:
 * ```typescript
 * const result: BulkImportResult = {
 *   insertedCount: 100,
 *   rejectedCount: 50,
 *   totalProcessed: 150,
 *   message: '50 transactions failed validation and were rejected'
 * };
 * ```
 */
export interface BulkImportResult {
  insertedCount: number
  rejectedCount?: number
  totalProcessed?: number
  message?: string
}

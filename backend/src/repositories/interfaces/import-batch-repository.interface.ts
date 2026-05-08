import { IImportBatch } from '../../models/import-batch.model'
import {
  PaginationParams,
  PaginatedResult,
  DeleteResult
} from '../../types/repository.types'

/**
 * Import Batch Repository Interface
 * Defines contract for import batch data access operations
 */
export interface IImportBatchRepository {
  /**
   * Create new import batch
   * @param batchData - Partial import batch data
   * @returns Created import batch document
   */
  create(batchData: Partial<IImportBatch>): Promise<IImportBatch>

  /**
   * Find batch by ID
   * @param batchId - Batch ID
   * @returns Import batch document or null if not found
   */
  findById(batchId: string): Promise<IImportBatch | null>

  /**
   * Find batches by user ID with pagination
   * @param userId - User ID
   * @param pagination - Pagination parameters
   * @returns Paginated import batch results sorted by createdAt descending
   */
  findByUserId(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<IImportBatch>>

  /**
   * Update batch status
   * @param batchId - Batch ID
   * @param status - New status (PENDING, PROCESSING, COMPLETED, FAILED)
   * @param terminalAt - Optional timestamp for terminal states (COMPLETED/FAILED)
   * @returns Updated import batch document or null if not found
   */
  updateStatus(
    batchId: string,
    status: string,
    terminalAt?: Date
  ): Promise<IImportBatch | null>

  /**
   * Update batch progress counters
   * @param batchId - Batch ID
   * @param processedCount - Number of processed items
   * @param rejectedCount - Number of rejected items
   * @returns Updated import batch document or null if not found
   */
  updateProgress(
    batchId: string,
    processedCount: number,
    rejectedCount: number
  ): Promise<IImportBatch | null>

  /**
   * Find pending batches for processing
   * @returns Array of batches with status PENDING
   */
  findPending(): Promise<IImportBatch[]>

  /**
   * Find stale batches for cleanup
   * @param thresholdDate - Date threshold for stale batches
   * @returns Array of batches with status PENDING or PROCESSING older than threshold
   */
  findStale(thresholdDate: Date): Promise<IImportBatch[]>

  /**
   * Delete old completed batches
   * @param beforeDate - Delete batches completed before this date
   * @returns Delete result with count
   */
  deleteOldCompleted(beforeDate: Date): Promise<DeleteResult>

  /**
   * Remove transactions array from batch to save storage
   * @param batchId - Batch ID
   * @returns True if updated, false if not found
   */
  removeTransactionsArray(batchId: string): Promise<boolean>
}

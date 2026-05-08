import { TransactionDocument } from '../../models/transaction.model'
import {
  PaginationParams,
  PaginatedResult,
  TransactionFilters,
  DeleteResult,
  BulkInsertResult
} from '../../types/repository.types'

/**
 * Transaction Repository Interface
 * Defines contract for transaction data access operations
 */
export interface ITransactionRepository {
  /**
   * Create single transaction
   * @param transactionData - Partial transaction data
   * @returns Created transaction document
   */
  create(
    transactionData: Partial<TransactionDocument>
  ): Promise<TransactionDocument>

  /**
   * Bulk create transactions
   * @param transactions - Array of partial transaction data
   * @returns Bulk insert result with count
   */
  bulkCreate(
    transactions: Partial<TransactionDocument>[]
  ): Promise<BulkInsertResult>

  /**
   * Find transaction by ID and user ID
   * @param transactionId - Transaction ID
   * @param userId - User ID (for authorization)
   * @returns Transaction document or null if not found
   */
  findById(
    transactionId: string,
    userId: string
  ): Promise<TransactionDocument | null>

  /**
   * Find transactions by user ID with filters and pagination
   * @param userId - User ID
   * @param filters - Transaction filters (keyword, type, date range, etc.)
   * @param pagination - Pagination parameters
   * @returns Paginated transaction results
   */
  findByUserId(
    userId: string,
    filters: TransactionFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<TransactionDocument>>

  /**
   * Find child transactions by parent ID
   * @param parentId - Parent transaction ID
   * @param userId - User ID (for authorization)
   * @param pagination - Pagination parameters
   * @returns Paginated child transaction results
   */
  findChildTransactions(
    parentId: string,
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<TransactionDocument>>

  /**
   * Find recurring transactions due for processing
   * @param currentDate - Current date to compare against nextRecurringDate
   * @returns Array of transactions due for processing
   */
  findRecurringDue(currentDate: Date): Promise<TransactionDocument[]>

  /**
   * Update transaction
   * @param transactionId - Transaction ID
   * @param userId - User ID (for authorization)
   * @param updates - Partial transaction data to update
   * @returns Updated transaction document or null if not found
   */
  update(
    transactionId: string,
    userId: string,
    updates: Partial<TransactionDocument>
  ): Promise<TransactionDocument | null>

  /**
   * Delete transaction by ID
   * @param transactionId - Transaction ID
   * @param userId - User ID (for authorization)
   * @returns True if deleted, false if not found
   */
  deleteById(transactionId: string, userId: string): Promise<boolean>

  /**
   * Bulk delete transactions by IDs
   * @param transactionIds - Array of transaction IDs
   * @param userId - User ID (for authorization)
   * @returns Delete result with count
   */
  bulkDelete(transactionIds: string[], userId: string): Promise<DeleteResult>

  /**
   * Delete child transactions by parent ID
   * @param parentId - Parent transaction ID
   * @param userId - User ID (for authorization)
   * @returns Delete result with count
   */
  deleteChildrenByParentId(
    parentId: string,
    userId: string
  ): Promise<DeleteResult>

  /**
   * Count transactions matching filter criteria
   * @param userId - User ID
   * @param filters - Transaction filters
   * @returns Count of matching transactions
   */
  countByFilters(userId: string, filters: TransactionFilters): Promise<number>

  /**
   * Execute aggregation pipeline
   * @param pipeline - MongoDB aggregation pipeline
   * @returns Aggregation results
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aggregate(pipeline: any[]): Promise<any[]>
}

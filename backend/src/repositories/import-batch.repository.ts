import ImportBatchModel, { IImportBatch } from '../models/import-batch.model'
import { IImportBatchRepository } from './interfaces/import-batch-repository.interface'
import {
  PaginationParams,
  PaginatedResult,
  DeleteResult
} from '../types/repository.types'
import { logger } from '../config/logger.config'

/**
 * Import Batch Repository Implementation
 * Handles data access operations for import batches
 */
export class ImportBatchRepository implements IImportBatchRepository {
  /**
   * Create new import batch
   */
  async create(batchData: Partial<IImportBatch>): Promise<IImportBatch> {
    try {
      const batch = await ImportBatchModel.create(batchData)
      logger.info('[APP:ImportBatch] Import batch created', {
        batchId: batch._id,
        userId: batch.userId,
        totalItems: batch.totalItems
      })
      return batch
    } catch (error) {
      logger.error('[APP:ImportBatch] Error creating import batch', {
        error,
        batchData
      })
      throw error
    }
  }

  /**
   * Find batch by ID
   */
  async findById(batchId: string): Promise<IImportBatch | null> {
    try {
      return await ImportBatchModel.findById(batchId).exec()
    } catch (error) {
      logger.error('[APP:ImportBatch] Error finding import batch by ID', {
        error,
        batchId
      })
      throw error
    }
  }

  /**
   * Find batches by user ID with pagination
   */
  async findByUserId(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<IImportBatch>> {
    try {
      const { pageNumber = 1, pageSize = 10 } = pagination
      const skip = (pageNumber - 1) * pageSize

      const [batches, totalCount] = await Promise.all([
        ImportBatchModel.find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .exec(),
        ImportBatchModel.countDocuments({ userId }).exec()
      ])

      const totalPages = Math.ceil(totalCount / pageSize)

      return {
        data: batches,
        pagination: {
          pageSize,
          pageNumber,
          totalCount,
          totalPages,
          skip
        }
      }
    } catch (error) {
      logger.error('[APP:ImportBatch] Error finding import batches by userId', {
        error,
        userId,
        pagination
      })
      throw error
    }
  }

  /**
   * Update batch status
   */
  async updateStatus(
    batchId: string,
    status: string,
    terminalAt?: Date
  ): Promise<IImportBatch | null> {
    try {
      const updateData: Record<string, unknown> = { status }

      // Set terminalAt for terminal states
      if (
        (status === 'COMPLETED' || status === 'FAILED') &&
        terminalAt !== undefined
      ) {
        updateData.terminalAt = terminalAt
      }

      const batch = await ImportBatchModel.findByIdAndUpdate(
        batchId,
        { $set: updateData },
        { new: true }
      ).exec()

      if (batch) {
        logger.info('[APP:ImportBatch] Import batch status updated', {
          batchId,
          status,
          terminalAt
        })
      }

      return batch
    } catch (error) {
      logger.error('[APP:ImportBatch] Error updating import batch status', {
        error,
        batchId,
        status
      })
      throw error
    }
  }

  /**
   * Update batch progress counters
   */
  async updateProgress(
    batchId: string,
    processedCount: number,
    rejectedCount: number
  ): Promise<IImportBatch | null> {
    try {
      const batch = await ImportBatchModel.findByIdAndUpdate(
        batchId,
        {
          $set: {
            processedCount,
            rejectedCount
          }
        },
        { new: true }
      ).exec()

      if (batch) {
        logger.info('[APP:ImportBatch] Import batch progress updated', {
          batchId,
          processedCount,
          rejectedCount
        })
      }

      return batch
    } catch (error) {
      logger.error('[APP:ImportBatch] Error updating import batch progress', {
        error,
        batchId,
        processedCount,
        rejectedCount
      })
      throw error
    }
  }

  /**
   * Find pending batches for processing
   */
  async findPending(): Promise<IImportBatch[]> {
    try {
      return await ImportBatchModel.find({ status: 'PENDING' })
        .sort({ createdAt: 1 })
        .exec()
    } catch (error) {
      logger.error('[APP:ImportBatch] Error finding pending import batches', {
        error
      })
      throw error
    }
  }

  /**
   * Find stale batches for cleanup
   */
  async findStale(thresholdDate: Date): Promise<IImportBatch[]> {
    try {
      return await ImportBatchModel.find({
        status: { $in: ['PENDING', 'PROCESSING'] },
        updatedAt: { $lt: thresholdDate }
      }).exec()
    } catch (error) {
      logger.error('[APP:ImportBatch] Error finding stale import batches', {
        error,
        thresholdDate
      })
      throw error
    }
  }

  /**
   * Delete old completed batches
   */
  async deleteOldCompleted(beforeDate: Date): Promise<DeleteResult> {
    try {
      const result = await ImportBatchModel.deleteMany({
        status: { $in: ['COMPLETED', 'FAILED'] },
        terminalAt: { $lt: beforeDate }
      }).exec()

      logger.info('[APP:ImportBatch] Old completed import batches deleted', {
        deletedCount: result.deletedCount,
        beforeDate
      })

      return {
        deletedCount: result.deletedCount || 0
      }
    } catch (error) {
      logger.error(
        '[APP:ImportBatch] Error deleting old completed import batches',
        {
          error,
          beforeDate
        }
      )
      throw error
    }
  }

  /**
   * Remove transactions array from batch to save storage
   */
  async removeTransactionsArray(batchId: string): Promise<boolean> {
    try {
      const result = await ImportBatchModel.updateOne(
        { _id: batchId },
        { $unset: { transactions: '' } }
      ).exec()

      const removed = result.modifiedCount > 0
      if (removed) {
        logger.info('[APP:ImportBatch] Transactions array removed from batch', {
          batchId
        })
      }

      return removed
    } catch (error) {
      logger.error(
        '[APP:ImportBatch] Error removing transactions array from batch',
        {
          error,
          batchId
        }
      )
      throw error
    }
  }
}

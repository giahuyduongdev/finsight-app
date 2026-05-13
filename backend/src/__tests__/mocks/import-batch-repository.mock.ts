/**
 * MockImportBatchRepository
 * In-memory implementation of IImportBatchRepository for testing
 */

import { IImportBatchRepository } from '../../repositories/interfaces/import-batch-repository.interface'
import { IImportBatch } from '../../models/import-batch.model'
import { PaginatedResult } from '../../types/repository.type'
import mongoose from 'mongoose'

export class MockImportBatchRepository implements IImportBatchRepository {
  private batches = new Map<string, IImportBatch>()

  async create(data: Partial<IImportBatch>): Promise<IImportBatch> {
    const id = new mongoose.Types.ObjectId()
    const batch = {
      _id: id,
      ...data,
      status: data.status || 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as IImportBatch

    this.batches.set(id.toString(), batch)
    return batch
  }

  async findById(batchId: string): Promise<IImportBatch | null> {
    return this.batches.get(batchId) || null
  }

  async findByUserId(
    userId: string,
    pagination: { pageNumber: number; pageSize: number }
  ): Promise<PaginatedResult<IImportBatch>> {
    const allBatches = Array.from(this.batches.values()).filter(
      (b) => b.userId.toString() === userId
    )

    // Sort by createdAt descending
    allBatches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    // Pagination
    const { pageSize, pageNumber } = pagination
    const skip = (pageNumber - 1) * pageSize
    const batches = allBatches.slice(skip, skip + pageSize)
    const totalCount = allBatches.length
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      data: batches,
      pagination: {
        totalCount,
        pageSize,
        pageNumber,
        totalPages,
        skip
      }
    }
  }

  async updateStatus(
    batchId: string,
    status: string,
    terminalAt?: Date
  ): Promise<IImportBatch | null> {
    const batch = this.batches.get(batchId)
    if (!batch) return null

    const updated = {
      ...batch,
      status,
      terminalAt:
        terminalAt || status === 'COMPLETED' || status === 'FAILED'
          ? new Date()
          : undefined,
      updatedAt: new Date()
    } as unknown as IImportBatch

    this.batches.set(batchId, updated)
    return updated
  }

  async updateProgress(
    batchId: string,
    processedCount: number,
    rejectedCount: number
  ): Promise<IImportBatch | null> {
    const batch = this.batches.get(batchId)
    if (!batch) return null

    const updated = {
      ...batch,
      processedCount,
      rejectedCount,
      updatedAt: new Date()
    } as unknown as IImportBatch

    this.batches.set(batchId, updated)
    return updated
  }

  async findPending(): Promise<IImportBatch[]> {
    return Array.from(this.batches.values()).filter(
      (b) => b.status === 'PENDING'
    )
  }

  async findStale(thresholdDate: Date): Promise<IImportBatch[]> {
    return Array.from(this.batches.values()).filter(
      (b) => b.status === 'PROCESSING' && b.updatedAt < thresholdDate
    )
  }

  async deleteOldCompleted(
    beforeDate: Date
  ): Promise<{ deletedCount: number }> {
    let deletedCount = 0

    for (const [id, batch] of this.batches.entries()) {
      if (
        batch.status === 'COMPLETED' &&
        batch.terminalAt &&
        batch.terminalAt < beforeDate
      ) {
        this.batches.delete(id)
        deletedCount++
      }
    }

    return { deletedCount }
  }

  async removeTransactionsArray(batchId: string): Promise<boolean> {
    const batch = this.batches.get(batchId)
    if (!batch) return false

    const updated = {
      ...batch,
      transactions: [],
      updatedAt: new Date()
    } as unknown as IImportBatch

    this.batches.set(batchId, updated)
    return true
  }

  // Test helper methods
  clear(): void {
    this.batches.clear()
  }

  getAll(): IImportBatch[] {
    return Array.from(this.batches.values())
  }
}

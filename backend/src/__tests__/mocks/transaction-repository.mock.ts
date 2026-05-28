/**
 * MockTransactionRepository
 * In-memory implementation of ITransactionRepository for testing
 */

import { ITransactionRepository } from '../../repositories/interfaces/transaction-repository.interface'
import { TransactionDocument } from '../../models/transaction.model'
import mongoose from 'mongoose'
import {
  DeleteResult,
  PaginatedResult,
  TransactionFilters
} from '../../types/repository.type'

export class MockTransactionRepository implements ITransactionRepository {
  private transactions = new Map<string, TransactionDocument>()
  private idCounter = 1

  async create(
    data: Partial<TransactionDocument>
  ): Promise<TransactionDocument> {
    const id = new mongoose.Types.ObjectId()
    const transaction = {
      _id: id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      toObject: function () {
        return { ...this }
      },
      omitPassword: function () {
        return this
      }
    } as unknown as TransactionDocument

    this.transactions.set(id.toString(), transaction)
    return transaction
  }

  async bulkCreate(
    transactions: Partial<TransactionDocument>[]
  ): Promise<{ insertedCount: number }> {
    for (const data of transactions) {
      await this.create(data)
    }
    return { insertedCount: transactions.length }
  }

  async findById(
    transactionId: string,
    userId: string
  ): Promise<TransactionDocument | null> {
    const transaction = this.transactions.get(transactionId)
    if (!transaction) return null
    if (transaction.userId.toString() !== userId) return null
    return transaction
  }

  async findByUserId(
    userId: string,
    filters: TransactionFilters,
    pagination: { pageSize: number; pageNumber: number }
  ): Promise<PaginatedResult<TransactionDocument>> {
    const allTransactions = Array.from(this.transactions.values()).filter(
      (t) => t.userId.toString() === userId && !t.recurringSourceId
    )

    // Apply filters
    let filtered = allTransactions

    if (filters.keyword) {
      const keyword = filters.keyword
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(keyword.toLowerCase()) ||
          t.category.toLowerCase().includes(keyword.toLowerCase())
      )
    }

    if (filters.type) {
      filtered = filtered.filter((t) => t.type === filters.type)
    }

    if (filters.currency) {
      filtered = filtered.filter((t) => t.currency === filters.currency)
    }

    if (filters.status) {
      filtered = filtered.filter((t) => t.status === filters.status)
    }

    if (filters.recurringStatus) {
      if (filters.recurringStatus === 'RECURRING') {
        filtered = filtered.filter((t) => t.isRecurring === true)
      } else if (filters.recurringStatus === 'NON_RECURRING') {
        filtered = filtered.filter((t) => t.isRecurring === false)
      }
    }

    // Sort by date descending
    filtered.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Pagination
    const { pageSize, pageNumber } = pagination
    const skip = (pageNumber - 1) * pageSize
    const transactions = filtered.slice(skip, skip + pageSize)
    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      data: transactions,
      pagination: {
        pageSize,
        pageNumber,
        totalCount,
        totalPages,
        skip
      }
    }
  }

  async findChildTransactions(
    userId: string,
    parentId: string,
    pagination: { pageNumber: number; pageSize: number }
  ): Promise<PaginatedResult<TransactionDocument>> {
    const children = Array.from(this.transactions.values()).filter(
      (t) =>
        t.userId.toString() === userId &&
        t.recurringSourceId?.toString() === parentId
    )

    // Sort by date descending
    children.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Pagination
    const { pageSize, pageNumber } = pagination
    const skip = (pageNumber - 1) * pageSize
    const paginatedChildren = children.slice(skip, skip + pageSize)
    const totalCount = children.length
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      data: paginatedChildren,
      pagination: {
        totalCount,
        pageSize,
        pageNumber,
        totalPages,
        skip
      }
    }
  }

  async findRecurringDue(currentDate: Date): Promise<TransactionDocument[]> {
    return Array.from(this.transactions.values()).filter(
      (t) =>
        t.isRecurring &&
        t.nextRecurringDate &&
        t.nextRecurringDate <= currentDate
    )
  }

  async update(
    transactionId: string,
    userId: string,
    updates: Partial<TransactionDocument>
  ): Promise<TransactionDocument | null> {
    const transaction = this.transactions.get(transactionId)
    if (!transaction) return null
    if (transaction.userId.toString() !== userId) return null

    const updated = {
      ...transaction,
      ...updates,
      updatedAt: new Date()
    } as TransactionDocument

    this.transactions.set(transactionId, updated)
    return updated
  }

  async deleteById(transactionId: string, userId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId)
    if (!transaction) return false
    if (transaction.userId.toString() !== userId) return false

    this.transactions.delete(transactionId)
    return true
  }

  async bulkDelete(
    transactionIds: string[],
    userId: string
  ): Promise<DeleteResult> {
    let deletedCount = 0

    for (const id of transactionIds) {
      const transaction = this.transactions.get(id)
      if (transaction && transaction.userId.toString() === userId) {
        this.transactions.delete(id)
        deletedCount++
      }
    }

    return { deletedCount }
  }

  async deleteChildrenByParentId(
    parentId: string,
    userId: string
  ): Promise<DeleteResult> {
    let deletedCount = 0

    for (const [id, transaction] of this.transactions.entries()) {
      if (
        transaction.recurringSourceId?.toString() === parentId &&
        transaction.userId.toString() === userId
      ) {
        this.transactions.delete(id)
        deletedCount++
      }
    }

    return { deletedCount }
  }

  async countByFilters(
    userId: string,
    filters: TransactionFilters
  ): Promise<number> {
    const result = await this.findByUserId(userId, filters, {
      pageSize: 1000,
      pageNumber: 1
    })
    return result.pagination.totalCount
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async aggregate(_pipeline: any[]): Promise<any[]> {
    // Simple mock implementation
    return []
  }

  // Test helper methods
  clear(): void {
    this.transactions.clear()
    this.idCounter = 1
  }

  getAll(): TransactionDocument[] {
    return Array.from(this.transactions.values())
  }

  seed(transactions: Partial<TransactionDocument>[]): void {
    for (const data of transactions) {
      const id = new mongoose.Types.ObjectId()
      const transaction = {
        _id: id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this }
        }
      } as unknown as TransactionDocument

      this.transactions.set(id.toString(), transaction)
    }
  }
}

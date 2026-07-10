/// <reference types="jest" />
/**
 * TransactionService Unit Tests
 * Tests business logic with mock repositories (no database required)
 */

import { TransactionService } from '../../../services/transaction.service'
import { MockTransactionRepository } from '../../mocks/transaction-repository.mock'
import { MockImportBatchRepository } from '../../mocks/import-batch-repository.mock'
import { NotFoundException } from '../../../utils/errors/index'
import mongoose from 'mongoose'
import {
  TransactionTypeEnum,
  PaymentMethodEnum,
  RecurringIntervalEnum
} from '../../../models/transaction.model'

// Mock cache utility
jest.mock('../../../utils/cache.util', () => ({
  invalidateUserAnalyticsCache: jest.fn()
}))

// Mock date utilities
jest.mock('../../../utils/dates/index', () => ({
  calculateNextOccurrence: jest.fn((date: Date) => {
    // Simple mock: add 1 month
    const next = new Date(date)
    next.setMonth(next.getMonth() + 1)
    return next
  }),
  getDateRange: jest.fn(() => ({
    from: undefined,
    to: undefined
  }))
}))

describe('TransactionService', () => {
  let transactionService: TransactionService
  let mockTransactionRepository: MockTransactionRepository
  let mockImportBatchRepository: MockImportBatchRepository
  let testUserId: string

  beforeEach(() => {
    // Initialize mocks
    mockTransactionRepository = new MockTransactionRepository()
    mockImportBatchRepository = new MockImportBatchRepository()

    // Initialize service with mocks
    transactionService = new TransactionService(
      mockTransactionRepository,
      mockImportBatchRepository
    )

    // Test user ID
    testUserId = new mongoose.Types.ObjectId().toString()
  })

  afterEach(() => {
    // Clean up
    mockTransactionRepository.clear()
    mockImportBatchRepository.clear()
  })

  // ─── create Tests ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a transaction successfully', async () => {
      // Arrange
      const transactionData = {
        type: TransactionTypeEnum.EXPENSE,
        title: 'Grocery Shopping',
        amount: 100,
        currency: 'USD',
        category: 'Food',
        date: new Date(),
        isRecurring: false,
        status: 'COMPLETED' as const,
        paymentMethod: PaymentMethodEnum.CASH,
        backfill: false
      }

      // Act
      const result = await transactionService.create(
        transactionData,
        testUserId
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.title).toBe('Grocery Shopping')
      expect(result.amount).toBe(100)
      expect(result.status).toBe('COMPLETED')
    })

    it('should create recurring transaction with nextRecurringDate', async () => {
      // Arrange
      const transactionData = {
        type: TransactionTypeEnum.EXPENSE,
        title: 'Monthly Rent',
        amount: 1000,
        currency: 'USD',
        category: 'Housing',
        date: new Date(),
        isRecurring: true,
        recurringInterval: RecurringIntervalEnum.MONTHLY,
        status: 'COMPLETED' as const,
        paymentMethod: PaymentMethodEnum.BANK_TRANSFER,
        backfill: false
      }

      // Act
      const result = await transactionService.create(
        transactionData,
        testUserId
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.isRecurring).toBe(true)
      expect(result.nextRecurringDate).toBeDefined()
    })
  })

  // ─── findByUserId Tests ───────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('should return paginated transactions for user', async () => {
      // Arrange
      await mockTransactionRepository.seed([
        {
          userId: new mongoose.Types.ObjectId(testUserId),
          type: TransactionTypeEnum.EXPENSE,
          title: 'Transaction 1',
          amount: 100,
          currency: 'USD',
          category: 'Food',
          date: new Date(),
          isRecurring: false,
          status: 'COMPLETED'
        },
        {
          userId: new mongoose.Types.ObjectId(testUserId),
          type: TransactionTypeEnum.INCOME,
          title: 'Transaction 2',
          amount: 200,
          currency: 'USD',
          category: 'Salary',
          date: new Date(),
          isRecurring: false,
          status: 'COMPLETED'
        }
      ])

      // Act
      const result = await transactionService.findByUserId(
        testUserId,
        {},
        { pageSize: 10, pageNumber: 1 }
      )

      // Assert
      expect(result.data).toHaveLength(2)
      expect(result.pagination.totalCount).toBe(2)
    })

    it('should filter transactions by type', async () => {
      // Arrange
      await mockTransactionRepository.seed([
        {
          userId: new mongoose.Types.ObjectId(testUserId),
          type: TransactionTypeEnum.EXPENSE,
          title: 'Expense 1',
          amount: 100,
          currency: 'USD',
          category: 'Food',
          date: new Date(),
          isRecurring: false,
          status: 'COMPLETED'
        },
        {
          userId: new mongoose.Types.ObjectId(testUserId),
          type: TransactionTypeEnum.INCOME,
          title: 'Income 1',
          amount: 200,
          currency: 'USD',
          category: 'Salary',
          date: new Date(),
          isRecurring: false,
          status: 'COMPLETED'
        }
      ])

      // Act
      const result = await transactionService.findByUserId(
        testUserId,
        { type: TransactionTypeEnum.EXPENSE },
        { pageSize: 10, pageNumber: 1 }
      )

      // Assert
      expect(result.data).toHaveLength(1)
      expect(result.data[0].type).toBe(TransactionTypeEnum.EXPENSE)
    })

    it('should filter transactions by import batch id', async () => {
      const importBatchId = new mongoose.Types.ObjectId()
      const otherImportBatchId = new mongoose.Types.ObjectId()

      await mockTransactionRepository.seed([
        {
          userId: new mongoose.Types.ObjectId(testUserId),
          type: TransactionTypeEnum.EXPENSE,
          title: 'Imported transaction',
          amount: 100,
          currency: 'USD',
          category: 'Food',
          date: new Date(),
          isRecurring: false,
          status: 'COMPLETED',
          importBatchId
        },
        {
          userId: new mongoose.Types.ObjectId(testUserId),
          type: TransactionTypeEnum.EXPENSE,
          title: 'Other imported transaction',
          amount: 200,
          currency: 'USD',
          category: 'Food',
          date: new Date(),
          isRecurring: false,
          status: 'COMPLETED',
          importBatchId: otherImportBatchId
        }
      ])

      const result = await transactionService.findByUserId(
        testUserId,
        { importBatchId: importBatchId.toString() },
        { pageSize: 10, pageNumber: 1 }
      )

      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toBe('Imported transaction')
      expect(result.pagination.totalCount).toBe(1)
    })
  })

  // ─── findById Tests ───────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return transaction when found', async () => {
      // Arrange
      const transaction = await mockTransactionRepository.create({
        userId: new mongoose.Types.ObjectId(testUserId),
        type: TransactionTypeEnum.EXPENSE,
        title: 'Test Transaction',
        amount: 100,
        currency: 'USD',
        category: 'Food',
        date: new Date(),
        isRecurring: false,
        status: 'COMPLETED'
      })

      // Act
      const result = await transactionService.findById(
        testUserId,
        transaction._id.toString()
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.title).toBe('Test Transaction')
    })

    it('should throw NotFoundException when transaction not found', async () => {
      // Act & Assert
      await expect(
        transactionService.findById(testUserId, 'non-existent-id')
      ).rejects.toThrow(NotFoundException)

      await expect(
        transactionService.findById(testUserId, 'non-existent-id')
      ).rejects.toThrow('Transaction not found')
    })
  })

  // ─── update Tests ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update transaction successfully', async () => {
      // Arrange
      const transaction = await mockTransactionRepository.create({
        userId: new mongoose.Types.ObjectId(testUserId),
        type: TransactionTypeEnum.EXPENSE,
        title: 'Old Title',
        amount: 100,
        currency: 'USD',
        category: 'Food',
        date: new Date(),
        isRecurring: false,
        status: 'COMPLETED'
      })

      const updateData = {
        title: 'New Title',
        amount: 150
      }

      // Act
      const result = await transactionService.update(
        testUserId,
        transaction._id.toString(),
        updateData
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.title).toBe('New Title')
      expect(result.amount).toBe(150)
    })

    it('should throw NotFoundException when transaction not found', async () => {
      // Arrange
      const updateData = {
        title: 'New Title'
      }

      // Act & Assert
      await expect(
        transactionService.update(testUserId, 'non-existent-id', updateData)
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ─── deleteById Tests ─────────────────────────────────────────────────────

  describe('deleteById', () => {
    it('should delete transaction successfully', async () => {
      // Arrange
      const transaction = await mockTransactionRepository.create({
        userId: new mongoose.Types.ObjectId(testUserId),
        type: TransactionTypeEnum.EXPENSE,
        title: 'Test Transaction',
        amount: 100,
        currency: 'USD',
        category: 'Food',
        date: new Date(),
        isRecurring: false,
        status: 'COMPLETED'
      })

      // Act
      await transactionService.deleteById(
        testUserId,
        transaction._id.toString()
      )

      // Assert
      const deleted = await mockTransactionRepository.findById(
        transaction._id.toString(),
        testUserId
      )
      expect(deleted).toBeNull()
    })

    it('should throw NotFoundException when transaction not found', async () => {
      // Act & Assert
      await expect(
        transactionService.deleteById(testUserId, 'non-existent-id')
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ─── bulkDelete Tests ─────────────────────────────────────────────────────

  describe('bulkDelete', () => {
    it('should delete multiple transactions successfully', async () => {
      // Arrange
      const transaction1 = await mockTransactionRepository.create({
        userId: new mongoose.Types.ObjectId(testUserId),
        type: TransactionTypeEnum.EXPENSE,
        title: 'Transaction 1',
        amount: 100,
        currency: 'USD',
        category: 'Food',
        date: new Date(),
        isRecurring: false,
        status: 'COMPLETED'
      })

      const transaction2 = await mockTransactionRepository.create({
        userId: new mongoose.Types.ObjectId(testUserId),
        type: TransactionTypeEnum.EXPENSE,
        title: 'Transaction 2',
        amount: 200,
        currency: 'USD',
        category: 'Food',
        date: new Date(),
        isRecurring: false,
        status: 'COMPLETED'
      })

      // Act
      const result = await transactionService.bulkDelete(testUserId, [
        transaction1._id.toString(),
        transaction2._id.toString()
      ])

      // Assert
      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(2)
    })

    it('should throw NotFoundException when no transactions found', async () => {
      // Act & Assert
      await expect(
        transactionService.bulkDelete(testUserId, ['non-existent-id'])
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ─── bulkImport Tests ─────────────────────────────────────────────────────

  describe('bulkImport', () => {
    it('should import multiple transactions successfully', async () => {
      // Arrange
      const transactions = [
        {
          type: TransactionTypeEnum.EXPENSE,
          title: 'Transaction 1',
          amount: 100,
          currency: 'USD',
          category: 'Food',
          date: new Date(),
          status: 'COMPLETED' as const,
          isRecurring: false,
          paymentMethod: PaymentMethodEnum.CASH
        },
        {
          type: TransactionTypeEnum.INCOME,
          title: 'Transaction 2',
          amount: 200,
          currency: 'USD',
          category: 'Salary',
          date: new Date(),
          status: 'COMPLETED' as const,
          isRecurring: false,
          paymentMethod: PaymentMethodEnum.BANK_TRANSFER
        }
      ]

      // Act
      const result = await transactionService.bulkImport(
        testUserId,
        transactions
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.insertedCount).toBe(2)
    })
  })
})

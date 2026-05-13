import { TransactionResponseDTO } from '../types/dto.type'
import { TransactionDocument } from '../models/transaction.model'

/**
 * Mapper function: Convert Transaction document to API response DTO
 * Transforms MongoDB document to JSON-friendly format for client
 */
export const toTransactionDTO = (
  transaction: TransactionDocument
): TransactionResponseDTO => {
  const data = transaction.toObject ? transaction.toObject() : transaction

  return {
    _id: data._id.toString(),
    userId: data.userId.toString(),
    title: data.title,
    type: data.type,
    amount: data.amount,
    currency: data.currency,
    category: data.category,
    date: data.date,
    description: data.description,
    isRecurring: data.isRecurring,
    recurringInterval: data.recurringInterval,
    status: data.status,
    paymentMethod: data.paymentMethod,
    receiptUrl: data.receiptUrl,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  }
}

/**
 * Mapper function: Convert array of Transaction documents to DTOs
 */
export const toTransactionDTOArray = (
  transactions: TransactionDocument[]
): TransactionResponseDTO[] => {
  return transactions.map(toTransactionDTO)
}

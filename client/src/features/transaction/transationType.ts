import {
  _TRANSACTION_FREQUENCY,
  _TransactionType,
  CurrencyType,
  DateRangePreset,
  PAYMENT_METHODS_ENUM
} from '@/constant'

type RecurringIntervalType =
  (typeof _TRANSACTION_FREQUENCY)[keyof typeof _TRANSACTION_FREQUENCY]
type PaymentMethodType =
  (typeof PAYMENT_METHODS_ENUM)[keyof typeof PAYMENT_METHODS_ENUM]

export interface CreateTransactionBody {
  title: string
  type: _TransactionType
  amount: number
  currency: CurrencyType
  description: string
  category: string
  date: string
  isRecurring: boolean
  recurringInterval?: RecurringIntervalType | null
  paymentMethod: string
  backfill?: boolean
}

export interface GetAllTransactionParams {
  keyword?: string
  type?: _TransactionType
  recurringStatus?: 'RECURRING' | 'NON_RECURRING'
  currency?: CurrencyType
  status?: 'COMPLETED' | 'PENDING' | 'FAILED'
  pageNumber?: number
  pageSize?: number
  dateRangePreset?: DateRangePreset
  from?: string | Date
  to?: string | Date
  timezone?: string
}

export interface TransactionType {
  _id: string
  userId: string
  title: string
  type: _TransactionType
  amount: number
  currency: CurrencyType
  description: string
  category: string
  date: string
  isRecurring: boolean
  recurringInterval: RecurringIntervalType | null
  nextRecurringDate: string | null
  lastProcessed: string | null
  status: string
  paymentMethod: string
  createdAt: string
  updatedAt: string
  id?: string
  recurringSourceId?: string | null
}

export interface GetAllTransactionResponse {
  message: string
  transactions: TransactionType[]
  pagination: {
    pageSize: number
    pageNumber: number
    totalCount: number
    totalPages: number
    skip: number
  }
}

export interface AIScanReceiptData {
  title: string
  amount: number
  currency: string
  date: string
  description: string
  category: string
  paymentMethod: string
  type: 'INCOME' | 'EXPENSE'
  receiptUrl: string
}

export interface AIScanReceiptResponse {
  message: string
  data: AIScanReceiptData
}

export interface GetSingleTransactionResponse {
  message: string
  transaction: TransactionType
}

export interface UpdateTransactionPayload {
  id: string
  transaction: CreateTransactionBody
}

export interface BulkTransactionType {
  title: string
  type: _TransactionType
  amount: number
  category: string
  description: string
  date: string
  paymentMethod: PaymentMethodType
  isRecurring: boolean
}

export interface BulkImportTransactionPayload {
  transactions: BulkTransactionType[]
}

export interface GetChildTransactionsResponse {
  message: string
  children: TransactionType[]
  pagination: {
    totalCount: number
    pageSize: number
    pageNumber: number
    totalPages: number
  }
}

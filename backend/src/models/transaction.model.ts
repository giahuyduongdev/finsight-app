import mongoose, { Document, Schema } from 'mongoose'
import { CurrencyEnum } from '../enums/currency.enum'

export enum TransactionStatusEnum {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum RecurringIntervalEnum {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export enum TransactionTypeEnum {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export enum PaymentMethodEnum {
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT',
  AUTO_DEBIT = 'AUTO_DEBIT',
  CASH = 'CASH',
  OTHER = 'OTHER'
}

export interface TransactionDocument extends Document {
  userId: mongoose.Types.ObjectId
  type: keyof typeof TransactionTypeEnum
  title: string
  amount: number
  currency: string
  category: string
  receiptUrl?: string
  recurringInterval?: keyof typeof RecurringIntervalEnum
  nextRecurringDate?: Date
  lastProcessed?: Date
  isRecurring: boolean
  description?: string
  date: Date
  status: keyof typeof TransactionStatusEnum
  paymentMethod: keyof typeof PaymentMethodEnum
  createdAt: Date
  updatedAt: Date
  recurringSourceId?: mongoose.Types.ObjectId
  importBatchId?: mongoose.Types.ObjectId
  importRowIndex?: number
}

const transactionSchema = new Schema<TransactionDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    type: {
      type: String,
      enum: Object.values(TransactionTypeEnum),
      required: true
    },
    title: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      enum: Object.values(CurrencyEnum),
      default: CurrencyEnum.USD
    },
    description: {
      type: String
    },
    category: {
      type: String,
      required: true
    },
    receiptUrl: {
      type: String
    },
    date: {
      type: Date,
      default: Date.now
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    recurringInterval: {
      type: String,
      enum: Object.values(RecurringIntervalEnum),
      default: null
    },
    nextRecurringDate: {
      type: Date,
      default: null
    },
    lastProcessed: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatusEnum),
      default: TransactionStatusEnum.COMPLETED
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethodEnum),
      default: PaymentMethodEnum.CASH
    },
    recurringSourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    },
    importBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportBatch'
    },
    importRowIndex: {
      type: Number,
      min: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// ─── Indexes ──────────────────────────────────────────────────────────────────

// 1. Query danh sách transactions của user (dùng nhiều nhất)
transactionSchema.index({ userId: 1, createdAt: -1 })

// 2. Filter theo type + date (INCOME/EXPENSE theo thời gian)
transactionSchema.index({ userId: 1, type: 1, date: -1 })

// 3. Filter theo status (PENDING/COMPLETED/FAILED)
transactionSchema.index({ userId: 1, status: 1 })

// 4. Cron job tìm recurring transactions đến hạn
transactionSchema.index({ isRecurring: 1, nextRecurringDate: 1 })

// 5. Expandable rows — lấy children của parent
transactionSchema.index({ recurringSourceId: 1, date: -1 })

// 5b. A recurring source can create at most one child per occurrence date.
transactionSchema.index(
  { recurringSourceId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recurringSourceId: { $type: 'objectId' }
    }
  }
)

transactionSchema.index(
  { importBatchId: 1, importRowIndex: 1 },
  {
    unique: true,
    partialFilterExpression: {
      importBatchId: { $type: 'objectId' },
      importRowIndex: { $type: 'number' }
    }
  }
)

// 6. Analytics — tính tổng theo khoảng thời gian
transactionSchema.index({ userId: 1, date: -1 })

// 7. Search theo title + category (keyword search)
transactionSchema.index({ userId: 1, title: 'text', category: 'text' })

// ─── Model ────────────────────────────────────────────────────────────────────

const TransactionModel = mongoose.model<TransactionDocument>(
  'Transaction',
  transactionSchema
)

export default TransactionModel

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
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

const TransactionModel = mongoose.model<TransactionDocument>(
  'Transaction',
  transactionSchema
)

export default TransactionModel

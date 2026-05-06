import mongoose, { Schema, Document } from 'mongoose'
import { TransactionDocument } from './transaction.model'

export interface IImportBatch extends Document {
  userId: mongoose.Types.ObjectId
  transactions: Partial<TransactionDocument>[] // Lưu mảng các giao dịch vào đây
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  terminalAt?: Date // Timestamp when batch reached terminal state (COMPLETED/FAILED)
  totalItems: number
  processedCount: number
  rejectedCount: number
  createdAt: Date
  updatedAt: Date
}

const ImportBatchSchema = new Schema<IImportBatch>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Không đặt required: true vì worker sẽ $unset field này sau khi xử lý xong
    transactions: { type: [Object] },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING'
    },
    terminalAt: { type: Date }, // Set when status becomes COMPLETED or FAILED
    totalItems: { type: Number, required: true },
    processedCount: { type: Number, default: 0, min: 0 },
    rejectedCount: { type: Number, default: 0, min: 0 }
  },
  {
    // timestamps: true tạo createdAt & updatedAt tự động
    // Bắt buộc phải có để TTL index trên createdAt hoạt động
    timestamps: true
  }
)

// TTL: Tự xóa document sau 24 giờ KỂ TỪ KHI hoàn thành hoặc thất bại
// Dùng terminalAt thay vì createdAt để đảm bảo batch xử lý lâu không bị xóa sớm
// Partial filter đảm bảo chỉ xóa batch đã hoàn thành
ImportBatchSchema.index(
  { terminalAt: 1 },
  {
    expireAfterSeconds: 86400, // 24 hours after terminal state
    partialFilterExpression: {
      status: { $in: ['COMPLETED', 'FAILED'] }
    }
  }
)

// Compound index for efficient stale batch queries
// Used by cleanup cron job to find old PENDING/PROCESSING batches
ImportBatchSchema.index({ status: 1, updatedAt: 1 })

export default mongoose.model<IImportBatch>('ImportBatch', ImportBatchSchema)

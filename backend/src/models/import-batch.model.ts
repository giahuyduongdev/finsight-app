import mongoose, { Schema, Document } from 'mongoose'

export interface IImportBatch extends Document {
  userId: mongoose.Types.ObjectId
  transactions: any[] // Lưu mảng 300 items vào đây (sau khi xử lý xong sẽ bị $unset)
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  totalItems: number
  processedCount: number
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
    totalItems: { type: Number, required: true },
    processedCount: { type: Number, default: 0 }
  },
  {
    // timestamps: true tạo createdAt & updatedAt tự động
    // Bắt buộc phải có để TTL index trên createdAt hoạt động
    timestamps: true
  }
)

// TTL: Tự xóa document sau 24 giờ (dọn rác tự động)
ImportBatchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

export default mongoose.model<IImportBatch>('ImportBatch', ImportBatchSchema)

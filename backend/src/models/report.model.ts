import mongoose, { Document } from 'mongoose'

export enum ReportStatusEnum {
  SENT = 'SENT',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  NO_ACTIVITY = 'NO_ACTIVITY'
}

export interface ReportDocument extends Document {
  userId: mongoose.Types.ObjectId
  settingId?: mongoose.Types.ObjectId
  dueDate?: Date
  deliveryKey?: string
  providerMessageId?: string
  attemptCount: number
  lastError?: string
  period: string
  sentDate: Date
  status: keyof typeof ReportStatusEnum
  createdAt: Date
  updatedAt: Date
}

const reportSchema = new mongoose.Schema<ReportDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    settingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportSetting'
    },
    dueDate: {
      type: Date
    },
    deliveryKey: {
      type: String
    },
    providerMessageId: {
      type: String
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastError: {
      type: String
    },
    period: {
      type: String,
      required: true
    },
    sentDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(ReportStatusEnum),
      default: ReportStatusEnum.PENDING
    }
  },
  {
    timestamps: true
  }
)

reportSchema.index(
  { deliveryKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deliveryKey: { $type: 'string' }
    }
  }
)

const ReportModel = mongoose.model<ReportDocument>('Report', reportSchema)
export default ReportModel

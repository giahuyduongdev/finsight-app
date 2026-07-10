import mongoose, { Document, Schema } from 'mongoose'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface NotificationMetadata {
  entityType?: string
  entityId?: string
  highlightId?: string
  [key: string]: unknown
}

export interface NotificationDocument extends Document {
  userId: mongoose.Types.ObjectId
  type: string
  title: string
  description?: string
  severity: NotificationSeverity
  unread: boolean
  actionUrl?: string
  metadata?: NotificationMetadata
  idempotencyKey?: string
  readAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
      required: true
    },
    unread: {
      type: Boolean,
      default: true,
      required: true
    },
    actionUrl: {
      type: String,
      trim: true,
      maxlength: 300
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 200
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, unread: 1, createdAt: -1 })
notificationSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    sparse: true
  }
)

const NotificationModel = mongoose.model<NotificationDocument>(
  'Notification',
  notificationSchema
)

export default NotificationModel

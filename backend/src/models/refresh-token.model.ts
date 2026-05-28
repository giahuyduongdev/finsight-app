import mongoose, { Document, Schema } from 'mongoose'

export interface RefreshTokenDocument extends Document {
  userId: mongoose.Types.ObjectId
  token: string
  expiresAt: Date
  isRevoked: boolean
  userAgent: string
  createdAt: Date
  updatedAt: Date
}

const refreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    token: {
      type: String,
      required: true,
      unique: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isRevoked: {
      type: Boolean,
      default: false
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
)

const RefreshTokenModel = mongoose.model<RefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema
)

export default RefreshTokenModel

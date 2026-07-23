import mongoose, { Document, Schema } from 'mongoose'

export interface RefreshTokenDocument extends Document {
  userId: mongoose.Types.ObjectId
  token: string
  expiresAt: Date
  isRevoked: boolean
  userAgent: string
  tokenFamilyId?: string
  rotatedFromToken?: string
  replacedByToken?: string
  rotatedAt?: Date
  reuseGraceUntil?: Date
  replayDetectedAt?: Date
  revocationReason?: 'logout' | 'logout-all' | 'rotated' | 'replay' | 'expired'
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
    },
    tokenFamilyId: {
      type: String,
      index: true
    },
    rotatedFromToken: {
      type: String
    },
    replacedByToken: {
      type: String
    },
    rotatedAt: {
      type: Date
    },
    reuseGraceUntil: {
      type: Date
    },
    replayDetectedAt: {
      type: Date
    },
    revocationReason: {
      type: String,
      enum: ['logout', 'logout-all', 'rotated', 'replay', 'expired']
    }
  },
  {
    timestamps: true
  }
)

refreshTokenSchema.index({ userId: 1, tokenFamilyId: 1, isRevoked: 1 })
refreshTokenSchema.index({ tokenFamilyId: 1, isRevoked: 1 })
refreshTokenSchema.index({ expiresAt: 1 })

const RefreshTokenModel = mongoose.model<RefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema
)

export default RefreshTokenModel

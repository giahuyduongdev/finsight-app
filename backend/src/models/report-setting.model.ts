import mongoose, { Document, Schema } from 'mongoose'

import { ReportFrequencyEnum } from '../enums/report-frequency.enum'

export interface ReportSettingDocument extends Document {
  userId: mongoose.Types.ObjectId
  frequency: keyof typeof ReportFrequencyEnum
  isEnabled: boolean
  nextReportDate?: Date
  lastSentDate?: Date
  createdAt: Date
  updatedAt: Date
}

const reportSettingSchema = new mongoose.Schema<ReportSettingDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    frequency: {
      type: String,
      enum: Object.values(ReportFrequencyEnum),
      default: ReportFrequencyEnum.MONTHLY
    },

    isEnabled: {
      type: Boolean,
      default: false
    },
    nextReportDate: {
      type: Date
    },
    lastSentDate: {
      type: Date
    }
  },
  {
    timestamps: true
  }
)

reportSettingSchema.index({ isEnabled: 1, nextReportDate: 1 })

const ReportSettingModel = mongoose.model<ReportSettingDocument>(
  'ReportSetting',
  reportSettingSchema
)
export default ReportSettingModel

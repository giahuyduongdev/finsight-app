import { IReportSettingRepository } from './interfaces/report-setting-repository.interface'
import ReportSettingModel, {
  ReportSettingDocument
} from '../models/report-setting.model'

/**
 * Report Setting Repository Implementation
 * Handles all report setting data access operations
 */
export class ReportSettingRepository implements IReportSettingRepository {
  /**
   * Find report settings by user ID
   */
  async findByUserId(userId: string): Promise<ReportSettingDocument | null> {
    return await ReportSettingModel.findOne({ userId })
  }

  /**
   * Create report settings for user
   */
  async create(
    settingData: Partial<ReportSettingDocument>
  ): Promise<ReportSettingDocument> {
    return await ReportSettingModel.create(settingData)
  }

  /**
   * Update report settings
   */
  async update(
    userId: string,
    updates: Partial<ReportSettingDocument>
  ): Promise<ReportSettingDocument | null> {
    return await ReportSettingModel.findOneAndUpdate({ userId }, updates, {
      new: true
    })
  }

  /**
   * Find enabled report settings due for processing
   * Filters by isEnabled = true and nextReportDate <= currentDate
   */
  async findEnabledDue(currentDate: Date): Promise<ReportSettingDocument[]> {
    return await ReportSettingModel.find({
      isEnabled: true,
      nextReportDate: { $lte: currentDate }
    }).populate('userId')
  }
}

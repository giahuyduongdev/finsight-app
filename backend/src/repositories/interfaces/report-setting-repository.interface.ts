import { ReportSettingDocument } from '../../models/report-setting.model'

/**
 * Report Setting Repository Interface
 * Defines contract for report setting data access operations
 */
export interface IReportSettingRepository {
  /**
   * Find report settings by user ID
   * @param userId - User ID
   * @returns Report setting document or null if not found
   */
  findByUserId(userId: string): Promise<ReportSettingDocument | null>

  /**
   * Create report settings for user
   * @param settingData - Partial report setting data
   * @returns Created report setting document
   */
  create(
    settingData: Partial<ReportSettingDocument>
  ): Promise<ReportSettingDocument>

  /**
   * Update report settings
   * @param userId - User ID
   * @param updates - Partial report setting data to update
   * @returns Updated report setting document or null if not found
   */
  update(
    userId: string,
    updates: Partial<ReportSettingDocument>
  ): Promise<ReportSettingDocument | null>

  /**
   * Find enabled report settings due for processing
   * @param currentDate - Current date to compare against nextReportDate
   * @returns Array of report settings that are enabled and due
   */
  findEnabledDue(currentDate: Date): Promise<ReportSettingDocument[]>
}

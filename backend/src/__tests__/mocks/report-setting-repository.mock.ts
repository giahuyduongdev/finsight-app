/**
 * MockReportSettingRepository
 * In-memory implementation of IReportSettingRepository for testing
 */

import { IReportSettingRepository } from '../../repositories/interfaces/report-setting-repository.interface'
import { ReportSettingDocument } from '../../models/report-setting.model'
import { ReportFrequencyEnum } from '../../enums/report-frequency.enum'
import mongoose from 'mongoose'

export class MockReportSettingRepository implements IReportSettingRepository {
  private settings: Map<string, ReportSettingDocument> = new Map()

  async create(
    settingData: Partial<ReportSettingDocument>
  ): Promise<ReportSettingDocument> {
    const id = new mongoose.Types.ObjectId()
    const setting = {
      _id: id,
      userId: settingData.userId || new mongoose.Types.ObjectId(),
      isEnabled: settingData.isEnabled ?? true,
      frequency: settingData.frequency || ReportFrequencyEnum.MONTHLY,
      nextReportDate: settingData.nextReportDate,
      lastSentDate: settingData.lastSentDate,
      createdAt: new Date(),
      updatedAt: new Date()
    } as ReportSettingDocument

    this.settings.set(setting.userId.toString(), setting)
    return setting
  }

  async findByUserId(userId: string): Promise<ReportSettingDocument | null> {
    return this.settings.get(userId) || null
  }

  async update(
    userId: string,
    updates: Partial<ReportSettingDocument>
  ): Promise<ReportSettingDocument | null> {
    const setting = this.settings.get(userId)
    if (!setting) return null

    Object.assign(setting, updates, { updatedAt: new Date() })
    this.settings.set(userId, setting)
    return setting
  }

  async findEnabledDue(currentDate: Date): Promise<ReportSettingDocument[]> {
    return Array.from(this.settings.values()).filter(
      (s) => s.isEnabled && s.nextReportDate && s.nextReportDate <= currentDate
    )
  }

  // Test helper methods
  clear(): void {
    this.settings.clear()
  }

  getAll(): ReportSettingDocument[] {
    return Array.from(this.settings.values())
  }

  getByUserId(userId: string): ReportSettingDocument | undefined {
    return this.settings.get(userId)
  }
}

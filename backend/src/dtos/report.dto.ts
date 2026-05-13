import {
  ReportSettingResponse,
  GenerateReportResponse
} from '../types/dto.type'
import { ReportSettingDocument } from '../models/report-setting.model'

/**
 * Mapper function: Convert ReportSetting document to API response DTO
 */
export const toReportSettingResponse = (
  reportSetting: ReportSettingDocument
): ReportSettingResponse => {
  const data = reportSetting.toObject ? reportSetting.toObject() : reportSetting

  return {
    message: 'Report settings retrieved successfully',
    data: {
      _id: data._id.toString(),
      userId: data.userId.toString(),
      frequency: data.frequency,
      isEnabled: data.isEnabled,
      lastSentDate: data.lastSentDate,
      nextReportDate: data.nextReportDate
    }
  }
}

/**
 * Mapper function: Create generate report response DTO
 */
export const toGenerateReportResponse = (data: {
  period: string
  summary: {
    income: number
    expenses: number
    balance: number
    savingsRate: number
    topCategories: Array<{
      name: string
      amount: number
      percent: number
    }>
  }
  currency: string
  insights: string[]
}): GenerateReportResponse => {
  return {
    message: 'Report generated successfully',
    period: data.period,
    summary: data.summary,
    currency: data.currency,
    insights: data.insights
  }
}

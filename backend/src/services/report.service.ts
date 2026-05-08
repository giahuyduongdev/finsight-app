import { generateWithFallback } from '../config/google-ai.config'
import ReportModel, { ReportStatusEnum } from '../models/report.model'
import { NotFoundException } from '../utils/errors/index'

import { calculateNextReportDate } from '../utils/dates/index'
import { reportInsightPrompt } from '../lib/prompts/report.prompt'
import { UpdateReportSettingType } from '../validators/report.validator'
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import TransactionModel, {
  TransactionTypeEnum
} from '../models/transaction.model'
import mongoose from 'mongoose'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { getExchangeRate } from '../lib/exchange-rate-currency'
import { sendReportEmail } from '../mailers/report.mailer'
import UserModel from '../models/user.model'
import { logger } from '../config/logger.config'
import { IReportRepository } from '../repositories/interfaces/report-repository.interface'
import { IReportSettingRepository } from '../repositories/interfaces/report-setting-repository.interface'

// ─── ReportService Class (New - DI-based) ────────────────────────────────────

/**
 * ReportService Class
 * Handles report-related business logic with dependency injection
 */
export class ReportService {
  constructor(
    private readonly reportRepository: IReportRepository,
    private readonly reportSettingRepository: IReportSettingRepository
  ) {}

  /**
   * Get all reports for a user with pagination
   * @param userId - User ID
   * @param pagination - Pagination parameters
   * @returns Paginated reports
   */
  async findByUserId(
    userId: string,
    pagination: { pageSize: number; pageNumber: number }
  ) {
    return await this.reportRepository.findByUserId(userId, pagination)
  }

  /**
   * Get report settings for a user
   * @param userId - User ID
   * @returns Report settings or null
   */
  async getSettings(userId: string) {
    return await this.reportSettingRepository.findByUserId(userId)
  }

  /**
   * Update report settings
   * @param userId - User ID
   * @param body - Update data
   * @returns Updated report settings
   * @throws NotFoundException if settings not found
   */
  async updateSettings(userId: string, body: UpdateReportSettingType) {
    const { isEnabled } = body
    let nextReportDate: Date | undefined

    const existingReportSetting =
      await this.reportSettingRepository.findByUserId(userId)
    if (!existingReportSetting)
      throw new NotFoundException('Report setting not found')

    if (isEnabled) {
      const currentNextReportDate = existingReportSetting.nextReportDate
      const now = new Date()
      if (!currentNextReportDate || currentNextReportDate <= now) {
        nextReportDate = calculateNextReportDate(
          existingReportSetting.lastSentDate,
          existingReportSetting.frequency
        )
      } else {
        nextReportDate = currentNextReportDate
      }
    }

    const updated = await this.reportSettingRepository.update(userId, {
      ...body,
      nextReportDate
    })

    if (!updated) throw new NotFoundException('Report setting not found')

    return updated
  }

  /**
   * Find report by period
   * @param userId - User ID
   * @param period - Report period
   * @returns Report or null
   */
  async findByPeriod(userId: string, period: string) {
    return await this.reportRepository.findByPeriod(userId, period)
  }

  /**
   * Update report status
   * @param reportId - Report ID
   * @param status - New status
   * @returns Updated report
   * @throws NotFoundException if report not found
   */
  async updateStatus(reportId: string, status: ReportStatusEnum) {
    const updated = await this.reportRepository.updateStatus(reportId, status)
    if (!updated) throw new NotFoundException('Report not found')
    return updated
  }

  /**
   * Resend a report
   * @param userId - User ID
   * @param reportId - Report ID
   * @returns Success message
   * @throws NotFoundException if report or user not found
   */
  async resendReport(userId: string, reportId: string) {
    // 1. Find report by ID (using repository would be better, but we need to check userId)
    const report = await ReportModel.findOne({
      _id: reportId,
      userId
    })
    if (!report) throw new NotFoundException('Report not found')

    // 2. Get user info
    const user = await UserModel.findById(userId)
    if (!user) throw new NotFoundException('User not found')

    // 3. Get report setting for frequency
    const reportSetting =
      await this.reportSettingRepository.findByUserId(userId)

    // 4. Calculate time period from old report
    const timezone = user.timezone || 'UTC'
    const now = new Date()

    const sentDate = new Date(report.sentDate)

    const from = fromZonedTime(
      startOfMonth(subMonths(toZonedTime(sentDate, timezone), 1)),
      timezone
    )
    const to = fromZonedTime(
      endOfMonth(subMonths(toZonedTime(sentDate, timezone), 1)),
      timezone
    )

    // 5. Generate report data
    const reportData = await generateReportService(
      userId,
      from,
      to,
      timezone,
      user.preferredCurrency
    )

    if (!reportData) {
      throw new NotFoundException('No activity found for this period')
    }

    // 6. Validate user data
    if (!user.email || !user.name) {
      throw new NotFoundException('User email or name not found')
    }

    // 7. Send email
    await sendReportEmail({
      email: user.email,
      username: user.name,
      report: {
        period: reportData.period,
        totalIncome: reportData.summary.income,
        totalExpenses: reportData.summary.expenses,
        availableBalance: reportData.summary.balance,
        savingsRate: reportData.summary.savingsRate,
        topSpendingCategories: reportData.summary.topCategories,
        insights: reportData.insights,
        currency: reportData.currency || user.preferredCurrency || 'USD'
      },
      frequency: reportSetting?.frequency || 'MONTHLY'
    })

    // 8. Update database
    await Promise.all([
      // Update Report
      this.reportRepository.updateStatus(reportId, ReportStatusEnum.SENT),

      // Update ReportSetting - only lastSentDate, keep nextReportDate unchanged
      this.reportSettingRepository.update(userId, {
        lastSentDate: now
      })
    ])

    return { message: 'Report resent successfully' }
  }
}

// ─── Old Service Functions (Deprecated - Keep for backward compatibility) ────

/**
 * @internal - Helper function for generating report data
 * Used by ReportService, report worker, and report controller
 */
export const generateReportService = async (
  userId: string,
  fromDate: Date,
  toDate: Date,
  timezone: string,
  preferredCurrency: string = 'USD'
) => {
  const results = await TransactionModel.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: fromDate, $lte: toDate }
      }
    },
    {
      $facet: {
        // Group theo currency
        summary: [
          {
            $group: {
              _id: '$currency',
              totalIncome: {
                $sum: {
                  $cond: [
                    { $eq: ['$type', TransactionTypeEnum.INCOME] },
                    '$amount',
                    0
                  ]
                }
              },
              totalExpenses: {
                $sum: {
                  $cond: [
                    { $eq: ['$type', TransactionTypeEnum.EXPENSE] },
                    '$amount',
                    0
                  ]
                }
              }
            }
          }
        ],
        // Group category theo currency
        categories: [
          { $match: { type: TransactionTypeEnum.EXPENSE } },
          {
            $group: {
              _id: { category: '$category', currency: '$currency' },
              total: { $sum: '$amount' }
            }
          },
          { $sort: { total: -1 } }
        ]
      }
    }
  ])

  if (!results?.length) return null

  const { summary = [], categories = [] } = results[0] || {}

  if (!summary.length) return null

  // Types for aggregation results
  type SummaryItem = {
    _id: string
    totalIncome: number
    totalExpenses: number
  }

  type CategoryItem = {
    _id: { category: string; currency: string }
    total: number
  }

  // Collect unique currencies
  const uniqueCurrencies = new Set<string>()
  summary.forEach((item: SummaryItem) => {
    uniqueCurrencies.add(item._id || 'USD')
  })
  categories.forEach((item: CategoryItem) => {
    uniqueCurrencies.add(item._id.currency || 'USD')
  })

  // Fetch rates once per unique currency
  const ratePromises = Array.from(uniqueCurrencies).map(async (currency) => ({
    currency,
    rate: await getExchangeRate(currency, preferredCurrency)
  }))
  const rates = await Promise.all(ratePromises)
  const rateMap = new Map(rates.map((r) => [r.currency, r.rate]))

  // Convert summary using rate map
  let convertedIncome = 0
  let convertedExpenses = 0

  summary.forEach((item: SummaryItem) => {
    const fromCurrency = item._id || 'USD'
    const rate = rateMap.get(fromCurrency) || 1
    convertedIncome += item.totalIncome * rate
    convertedExpenses += item.totalExpenses * rate
  })

  if (convertedIncome === 0 && convertedExpenses === 0) return null

  // Convert categories using rate map
  const categoryMap: Record<string, number> = {}
  categories.forEach((item: CategoryItem) => {
    const { category, currency } = item._id
    const fromCurrency = currency || 'USD'
    const rate = rateMap.get(fromCurrency) || 1
    const convertedTotal = item.total * rate
    categoryMap[category] = (categoryMap[category] || 0) + convertedTotal
  })

  // Sort và limit top 5
  const top5Categories = Object.entries(categoryMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const byCategory = top5Categories.reduce(
    (acc, [name, amount]) => {
      acc[name] = {
        amount,
        percentage:
          convertedExpenses > 0
            ? Math.round((amount / convertedExpenses) * 100)
            : 0
      }
      return acc
    },
    {} as Record<string, { amount: number; percentage: number }>
  )

  const availableBalance = convertedIncome - convertedExpenses
  const savingsRate = calculateSavingRate(convertedIncome, convertedExpenses)

  const periodLabel = `${formatInTimeZone(fromDate, timezone, 'MMMM d')} - ${formatInTimeZone(toDate, timezone, 'd, yyyy')}`

  const insights = await generateInsightsAI({
    totalIncome: convertedIncome,
    totalExpenses: convertedExpenses,
    availableBalance,
    savingsRate,
    categories: byCategory,
    periodLabel,
    currency: preferredCurrency
  })

  return {
    period: periodLabel,
    summary: {
      income: convertedIncome,
      expenses: convertedExpenses,
      balance: availableBalance,
      savingsRate: Number(savingsRate.toFixed(1)),
      topCategories: Object.entries(byCategory).map(([name, cat]) => ({
        name,
        amount: cat.amount,
        percent: cat.percentage
      }))
    },
    currency: preferredCurrency,
    insights
  }
}

async function generateInsightsAI({
  totalIncome,
  totalExpenses,
  availableBalance,
  savingsRate,
  categories,
  periodLabel,
  currency = 'USD'
}: {
  totalIncome: number
  totalExpenses: number
  availableBalance: number
  savingsRate: number
  categories: Record<string, { amount: number; percentage: number }>
  periodLabel: string
  currency?: string
}) {
  try {
    const prompt = reportInsightPrompt({
      totalIncome,
      totalExpenses,
      availableBalance,
      savingsRate: Number(savingsRate.toFixed(1)),
      categories,
      periodLabel,
      currency
    })

    const result = await generateWithFallback(
      [{ role: 'user', parts: [{ text: prompt }] }],
      { responseMimeType: 'application/json' }
    )

    const response = result.text
    const cleanedText = response?.replace(/```(?:json)?\n?/g, '').trim()

    if (!cleanedText) return []

    const data = JSON.parse(cleanedText)
    return data
  } catch (error) {
    logger.error('[APP:Report] Failed to generate AI insights', {
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

function calculateSavingRate(totalIncome: number, totalExpenses: number) {
  if (totalIncome <= 0) return 0
  const savingRate = ((totalIncome - totalExpenses) / totalIncome) * 100
  return parseFloat(savingRate.toFixed(2))
}

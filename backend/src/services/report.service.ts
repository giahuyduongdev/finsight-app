import { generateWithFallback } from '../config/google-ai.config'
import ReportSettingModel from '../models/report-setting.model'
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

export const getAllReportsService = async (
  userId: string,
  pagination: { pageSize: number; pageNumber: number }
) => {
  const query: Record<string, any> = { userId }

  const { pageSize, pageNumber } = pagination
  const skip = (pageNumber - 1) * pageSize

  const [reports, totalCount] = await Promise.all([
    ReportModel.find(query).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
    ReportModel.countDocuments(query)
  ])

  const totalPages = Math.ceil(totalCount / pageSize)
  return {
    reports,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip
    }
  }
}

export const updateReportSettingService = async (
  userId: string,
  body: UpdateReportSettingType
) => {
  const { isEnabled } = body
  let nextReportDate: Date | null = null

  const existingReportSetting = await ReportSettingModel.findOne({ userId })
  if (!existingReportSetting)
    throw new NotFoundException('Report setting not found"')

  if (isEnabled) {
    const currentNextReportDate = existingReportSetting.nextReportDate
    const now = new Date()
    if (!currentNextReportDate || currentNextReportDate <= now) {
      nextReportDate = calculateNextReportDate(
        existingReportSetting.lastSentDate,
        existingReportSetting.frequency as any
      )
    } else {
      nextReportDate = currentNextReportDate
    }
  }

  existingReportSetting.set({
    ...body,
    nextReportDate
  })

  await existingReportSetting.save()
  return existingReportSetting
}

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

  // Convert từng currency về preferredCurrency
  let convertedIncome = 0
  let convertedExpenses = 0

  for (const item of summary) {
    const fromCurrency = item._id || 'USD'
    const rate = await getExchangeRate(fromCurrency, preferredCurrency)
    convertedIncome += item.totalIncome * rate
    convertedExpenses += item.totalExpenses * rate
  }

  if (convertedIncome === 0 && convertedExpenses === 0) return null

  // Convert categories theo currency
  const categoryMap: Record<string, number> = {}
  for (const item of categories) {
    const { category, currency } = item._id
    const fromCurrency = currency || 'USD'
    const rate = await getExchangeRate(fromCurrency, preferredCurrency)
    const convertedTotal = item.total * rate
    categoryMap[category] = (categoryMap[category] || 0) + convertedTotal
  }

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
    return []
  }
}

function calculateSavingRate(totalIncome: number, totalExpenses: number) {
  if (totalIncome <= 0) return 0
  const savingRate = ((totalIncome - totalExpenses) / totalIncome) * 100
  return parseFloat(savingRate.toFixed(2))
}

export const resendReportService = async (userId: string, reportId: string) => {
  // 1. Lấy report từ DB
  const report = await ReportModel.findOne({
    _id: reportId,
    userId
  })
  if (!report) throw new NotFoundException('Report not found')

  // 2. Lấy user info
  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  // 3. Lấy report setting để lấy frequency
  const reportSetting = await ReportSettingModel.findOne({ userId })

  // 4. Phân tích mốc thời gian từ Report cũ
  const timezone = user.timezone || 'UTC'
  const now = new Date()

  // Lấy thời điểm gửi của báo cáo cũ để làm mốc tính toán
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

  // 6. Gửi email
  await sendReportEmail({
    email: user.email!,
    username: user.name!,
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

  // 7. CẬP NHẬT DATABASE (Chạy song song để tối ưu tốc độ)
  await Promise.all([
    // 7a. Cập nhật Report (Ghi nhận thời gian gửi lại)
    ReportModel.findByIdAndUpdate(reportId, {
      $set: {
        sentDate: now,
        status: ReportStatusEnum.SENT,
        updatedAt: now // Đã bổ sung
      }
    }),

    // 7b. Cập nhật ReportSetting
    // LƯU Ý QUAN TRỌNG: Chỉ cập nhật lastSentDate, TUYỆT ĐỐI GIỮ NGUYÊN nextReportDate để không phá chu kỳ Cronjob
    ReportSettingModel.updateOne(
      { userId },
      {
        $set: {
          lastSentDate: now, // Đã bổ sung
          updatedAt: now // Đã bổ sung
        }
      }
    )
  ])

  return { message: 'Report resent successfully' }
}

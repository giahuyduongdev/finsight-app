import mongoose, { PipelineStage } from 'mongoose'
import { DateRangeEnum, DateRangePreset } from '../enums/date-range.enum'
import TransactionModel, {
  TransactionStatusEnum,
  TransactionTypeEnum
} from '../models/transaction.model'
import { getDateRange } from '../utils/dates'
import { differenceInDays, subDays, subYears } from 'date-fns'
import { getExchangeRate } from '../lib/exchange-rate-currency'
import { redis } from '../config/redis.config'

export const summaryAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date,
  timezone: string = 'UTC',
  preferredCurrency: string = 'USD'
) => {
  const range = getDateRange(dateRangePreset, customFrom, customTo, timezone)
  const { from, to, value: rangeValue } = range

  const fromKey = from ? new Date(from).setHours(0, 0, 0, 0) : 'all'
  const toKey = to ? new Date(to).setHours(0, 0, 0, 0) : 'all'
  const cacheKey = `analytics:summary:${userId}:${rangeValue}:${timezone}:${preferredCurrency}:${fromKey}:${toKey}`

  // Check Redis cache trước
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  const currentPeriodPipeline: PipelineStage[] = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: TransactionStatusEnum.COMPLETED,
        ...(from && to && { date: { $gte: from, $lte: to } })
      }
    },
    {
      $group: {
        _id: '$currency', // Group theo currency
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
        },
        transactionCount: { $sum: 1 }
      }
    }
  ]

  const currentResults = await TransactionModel.aggregate(currentPeriodPipeline)

  // Convert về preferredCurrency
  let totalIncome = 0
  let totalExpenses = 0
  let transactionCount = 0

  for (const item of currentResults) {
    const fromCurrency = item._id || 'USD'
    const rate = await getExchangeRate(fromCurrency, preferredCurrency)
    totalIncome += item.totalIncome * rate
    totalExpenses += item.totalExpenses * rate
    transactionCount += item.transactionCount
  }

  const availableBalance = totalIncome - totalExpenses
  const savingsPercentage =
    totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0
  const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0

  let percentageChange: any = {
    income: 0,
    expenses: 0,
    balance: 0,
    prevPeriodFrom: null,
    prevPeriodTo: null,
    previousValues: {
      incomeAmount: 0,
      expenseAmount: 0,
      balanceAmount: 0
    }
  }

  if (from && to && rangeValue !== DateRangeEnum.ALL_TIME) {
    const period = differenceInDays(to, from) + 1
    const isYearly = [
      DateRangeEnum.LAST_YEAR,
      DateRangeEnum.THIS_YEAR
    ].includes(rangeValue)
    const prevPeriodFrom = isYearly ? subYears(from, 1) : subDays(from, period)
    const prevPeriodTo = isYearly ? subYears(to, 1) : subDays(to, period)

    const prevPeriodPipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: TransactionStatusEnum.COMPLETED,
          date: { $gte: prevPeriodFrom, $lte: prevPeriodTo }
        }
      },
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
    ]

    const prevResults = await TransactionModel.aggregate(prevPeriodPipeline)

    // Convert kỳ trước về preferredCurrency
    let prevIncome = 0
    let prevExpenses = 0

    for (const item of prevResults) {
      const fromCurrency = item._id || 'USD'
      const rate = await getExchangeRate(fromCurrency, preferredCurrency)
      prevIncome += item.totalIncome * rate
      prevExpenses += item.totalExpenses * rate
    }

    const prevBalance = prevIncome - prevExpenses

    percentageChange = {
      income: calculatePercentageChange(prevIncome, totalIncome),
      expenses: calculatePercentageChange(prevExpenses, totalExpenses),
      balance: calculatePercentageChange(prevBalance, availableBalance),
      prevPeriodFrom,
      prevPeriodTo,
      previousValues: {
        incomeAmount: prevIncome,
        expenseAmount: prevExpenses,
        balanceAmount: prevBalance
      }
    }
  }

  const result = {
    availableBalance,
    totalIncome,
    totalExpenses,
    savingRate: {
      percentage: parseFloat(savingsPercentage.toFixed(2)),
      expenseRatio: parseFloat(expenseRatio.toFixed(2))
    },
    transactionCount,
    percentageChange,
    currency: preferredCurrency,
    preset: {
      ...range,
      value: rangeValue || DateRangeEnum.ALL_TIME,
      label: range?.label || 'All Time'
    }
  }

  // Lưu Redis TTL = 5 phút
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 300)

  return result
}

export const chartAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date,
  timezone: string = 'UTC',
  preferredCurrency: string = 'USD' //
) => {
  const range = getDateRange(dateRangePreset, customFrom, customTo, timezone)
  const { from, to, value: rangeValue } = range

  const fromKey = from ? new Date(from).setHours(0, 0, 0, 0) : 'all'
  const toKey = to ? new Date(to).setHours(0, 0, 0, 0) : 'all'
  const cacheKey = `analytics:chart:${userId}:${rangeValue}:${timezone}:${preferredCurrency}:${fromKey}:${toKey}`

  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  const filter: any = {
    userId: new mongoose.Types.ObjectId(userId),
    status: TransactionStatusEnum.COMPLETED,
    ...(from && to && { date: { $gte: from, $lte: to } })
  }

  const result = await TransactionModel.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$date',
              timezone: timezone
            }
          },
          currency: '$currency' // thêm currency
        },
        income: {
          $sum: {
            $cond: [
              { $eq: ['$type', TransactionTypeEnum.INCOME] },
              '$amount',
              0
            ]
          }
        },
        expenses: {
          $sum: {
            $cond: [
              { $eq: ['$type', TransactionTypeEnum.EXPENSE] },
              '$amount',
              0
            ]
          }
        },
        incomeCount: {
          $sum: {
            $cond: [{ $eq: ['$type', TransactionTypeEnum.INCOME] }, 1, 0]
          }
        },
        expenseCount: {
          $sum: {
            $cond: [{ $eq: ['$type', TransactionTypeEnum.EXPENSE] }, 1, 0]
          }
        }
      }
    },
    { $sort: { '_id.date': 1 } }
  ])

  // Convert và group theo ngày
  const dateMap: Record<
    string,
    {
      income: number
      expenses: number
      incomeCount: number
      expenseCount: number
    }
  > = {}

  for (const item of result) {
    const date = item._id.date
    const fromCurrency = item._id.currency || 'USD'
    const rate = await getExchangeRate(fromCurrency, preferredCurrency)

    if (!dateMap[date]) {
      dateMap[date] = {
        income: 0,
        expenses: 0,
        incomeCount: 0,
        expenseCount: 0
      }
    }

    dateMap[date].income += item.income * rate
    dateMap[date].expenses += item.expenses * rate
    dateMap[date].incomeCount += item.incomeCount
    dateMap[date].expenseCount += item.expenseCount
  }

  const chartData = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      income: data.income,
      expenses: data.expenses
    }))

  const totalIncomeCount = Object.values(dateMap).reduce(
    (sum, d) => sum + d.incomeCount,
    0
  )
  const totalExpenseCount = Object.values(dateMap).reduce(
    (sum, d) => sum + d.expenseCount,
    0
  )

  const result2 = {
    chartData,
    totalIncomeCount,
    totalExpenseCount,
    currency: preferredCurrency,
    preset: {
      ...range,
      value: rangeValue || DateRangeEnum.ALL_TIME,
      label: range?.label || 'All Time'
    }
  }

  // Lưu Redis TTL = 5 phút
  await redis.set(cacheKey, JSON.stringify(result2), 'EX', 300)

  return result2
}

export const expensePieChartBreakdownService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date,
  timezone: string = 'UTC',
  preferredCurrency: string = 'USD' //
) => {
  const range = getDateRange(dateRangePreset, customFrom, customTo, timezone)
  const { from, to, value: rangeValue } = range

  const fromKey = from ? new Date(from).setHours(0, 0, 0, 0) : 'all'
  const toKey = to ? new Date(to).setHours(0, 0, 0, 0) : 'all'
  const cacheKey = `analytics:pie:${userId}:${rangeValue}:${timezone}:${preferredCurrency}:${fromKey}:${toKey}`

  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  const filter: any = {
    userId: new mongoose.Types.ObjectId(userId),
    type: TransactionTypeEnum.EXPENSE,
    status: TransactionStatusEnum.COMPLETED,
    ...(from && to && { date: { $gte: from, $lte: to } })
  }

  // Group theo category + currency
  const result = await TransactionModel.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { category: '$category', currency: '$currency' },
        value: { $sum: '$amount' }
      }
    },
    { $sort: { value: -1 } }
  ])

  // Convert về preferredCurrency và group theo category
  const categoryMap: Record<string, number> = {}

  for (const item of result) {
    const { category, currency } = item._id
    const fromCurrency = currency || 'USD'
    const rate = await getExchangeRate(fromCurrency, preferredCurrency)
    const convertedValue = item.value * rate
    categoryMap[category] = (categoryMap[category] || 0) + convertedValue
  }

  // Sort và lấy top 3 + others
  const sorted = Object.entries(categoryMap).sort(([, a], [, b]) => b - a)
  const top3 = sorted.slice(0, 3)
  const others = sorted.slice(3)

  const othersTotal = others.reduce((sum, [, val]) => sum + val, 0)

  const totalSpent = Object.values(categoryMap).reduce(
    (sum, val) => sum + val,
    0
  )

  const breakdown = [
    ...top3.map(([name, value]) => ({
      name,
      value,
      percentage: totalSpent > 0 ? Math.round((value / totalSpent) * 100) : 0
    })),
    ...(othersTotal > 0
      ? [
          {
            name: 'others',
            value: othersTotal,
            percentage: Math.round((othersTotal / totalSpent) * 100)
          }
        ]
      : [])
  ]

  const resultData = {
    totalSpent,
    breakdown,
    currency: preferredCurrency,
    preset: {
      ...range,
      value: rangeValue || DateRangeEnum.ALL_TIME,
      label: range?.label || 'All Time'
    }
  }

  // Lưu Redis TTL = 5 phút
  await redis.set(cacheKey, JSON.stringify(resultData), 'EX', 300)

  return resultData
}

function calculatePercentageChange(previous: number, current: number) {
  // Nếu kỳ trước bằng 0:
  // - Nếu kỳ này cũng bằng 0 -> Không thay đổi (0%)
  // - Nếu kỳ này có tiền -> Tính là tăng 100% (quy ước UI phổ biến để tránh lỗi chia cho 0)
  if (previous === 0) return current === 0 ? 0 : 100

  // Tính phần trăm thực tế
  const changes = ((current - previous) / Math.abs(previous)) * 100

  // Trả về số thực tế, làm tròn 2 chữ số thập phân (Không dùng Math.min/max nữa)
  return parseFloat(changes.toFixed(2))
}

import { Request, Response } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { HTTPSTATUS } from '../config/http.config'
import { DateRangePreset } from '../enums/date-range.enum'
import { CurrencyService } from '../services/currency.service'
import TransactionModel from '../models/transaction.model'
import { getUserId } from '../utils/getUserId.util'
import { container } from '../container'

// Get AnalyticsService instance from DI container
const analyticsService = container.getAnalyticsService()

export const summaryAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    // Validate date parameters
    let customFrom: Date | undefined
    let customTo: Date | undefined

    if (from) {
      customFrom = new Date(from as string)
      if (isNaN(customFrom.getTime())) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: 'Invalid "from" date parameter'
        })
      }
    }

    if (to) {
      customTo = new Date(to as string)
      if (isNaN(customTo.getTime())) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: 'Invalid "to" date parameter'
        })
      }
    }

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom,
      customTo
    }

    const stats = await analyticsService.getAnalytics(
      userId,
      filter.dateRangePreset,
      filter.customFrom,
      filter.customTo,
      timezone,
      preferredCurrency
    )

    return res.status(HTTPSTATUS.OK).json({
      message: 'Summary fetched successfully',
      data: stats
    })
  }
)

export const chartAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    // Validate date parameters
    let customFrom: Date | undefined
    let customTo: Date | undefined

    if (from) {
      customFrom = new Date(from as string)
      if (isNaN(customFrom.getTime())) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: 'Invalid "from" date parameter'
        })
      }
    }

    if (to) {
      customTo = new Date(to as string)
      if (isNaN(customTo.getTime())) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: 'Invalid "to" date parameter'
        })
      }
    }

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom,
      customTo
    }

    const chartData = await analyticsService.getChartAnalytics(
      userId,
      filter.dateRangePreset,
      filter.customFrom,
      filter.customTo,
      timezone,
      preferredCurrency
    )

    return res.status(HTTPSTATUS.OK).json({
      message: 'Chart fetched successfully',
      data: chartData
    })
  }
)

export const expensePieChartBreakdownController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    // Validate date parameters
    let customFrom: Date | undefined
    let customTo: Date | undefined

    if (from) {
      customFrom = new Date(from as string)
      if (isNaN(customFrom.getTime())) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: 'Invalid "from" date parameter'
        })
      }
    }

    if (to) {
      customTo = new Date(to as string)
      if (isNaN(customTo.getTime())) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: 'Invalid "to" date parameter'
        })
      }
    }

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom,
      customTo
    }

    const pieChartData = await analyticsService.getCategoryBreakdown(
      userId,
      filter.dateRangePreset,
      filter.customFrom,
      filter.customTo,
      timezone,
      preferredCurrency
    )

    return res.status(HTTPSTATUS.OK).json({
      message: 'Expense breakdown fetched successfully',
      data: pieChartData
    })
  }
)

export const getExchangeRatesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)

    // Lấy tỉ giá mới nhất
    const rates = await CurrencyService.getLatestRates()

    // Lấy danh sách tiền tệ người dùng đã từng sử dụng trong transactions
    const usedCurrencies = await TransactionModel.distinct('currency', {
      userId
    })

    return res.status(HTTPSTATUS.OK).json({
      message: 'Exchange rates fetched successfully',
      data: {
        ...rates,
        usedCurrencies
      }
    })
  }
)

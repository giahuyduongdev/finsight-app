import { Request, Response } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { HTTPSTATUS } from '../config/http.config'
import { DateRangePreset } from '../enums/date-range.enum'
import { CurrencyService } from '../services/currency.service'
import TransactionModel from '../models/transaction.model'
import { getUserId } from '../utils/getUserId.util'
import { container } from '../container'
import { parseDateQuery } from '../utils/query-parser.util'
import { ResponseFormatter } from '../utils/responseFormatter.util'
import { BadRequestException } from '../utils/errors'

// Get AnalyticsService instance from DI container
const analyticsService = container.getAnalyticsService()

export const summaryAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    // Parse and validate date parameters
    const customFrom = parseDateQuery(from)
    const customTo = parseDateQuery(to)

    if (from && !customFrom) {
      throw new BadRequestException('Invalid "from" date parameter')
    }

    if (to && !customTo) {
      throw new BadRequestException('Invalid "to" date parameter')
    }

    const stats = await analyticsService.getAnalytics(
      userId,
      preset as DateRangePreset,
      customFrom,
      customTo,
      timezone,
      preferredCurrency
    )

    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(stats, {
        message: 'Summary fetched successfully'
      })
    )
  }
)

export const chartAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    // Parse and validate date parameters
    const customFrom = parseDateQuery(from)
    const customTo = parseDateQuery(to)

    if (from && !customFrom) {
      throw new BadRequestException('Invalid "from" date parameter')
    }

    if (to && !customTo) {
      throw new BadRequestException('Invalid "to" date parameter')
    }

    const chartData = await analyticsService.getChartAnalytics(
      userId,
      preset as DateRangePreset,
      customFrom,
      customTo,
      timezone,
      preferredCurrency
    )

    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(chartData, {
        message: 'Chart fetched successfully'
      })
    )
  }
)

export const expensePieChartBreakdownController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    // Parse and validate date parameters
    const customFrom = parseDateQuery(from)
    const customTo = parseDateQuery(to)

    if (from && !customFrom) {
      throw new BadRequestException('Invalid "from" date parameter')
    }

    if (to && !customTo) {
      throw new BadRequestException('Invalid "to" date parameter')
    }

    const pieChartData = await analyticsService.getCategoryBreakdown(
      userId,
      preset as DateRangePreset,
      customFrom,
      customTo,
      timezone,
      preferredCurrency
    )

    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(pieChartData, {
        message: 'Expense breakdown fetched successfully'
      })
    )
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

    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(
        {
          ...rates,
          usedCurrencies
        },
        { message: 'Exchange rates fetched successfully' }
      )
    )
  }
)

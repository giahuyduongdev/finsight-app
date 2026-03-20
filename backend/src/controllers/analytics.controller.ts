import { Request, Response } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { HTTPSTATUS } from '../config/http.config'
import { DateRangePreset } from '../enums/date-range.enum'
import { fromZonedTime } from 'date-fns-tz'
import {
  chartAnalyticsService,
  expensePieChartBreakdownService,
  summaryAnalyticsService
} from '../services/analytics.service'

export const summaryAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom: from
        ? fromZonedTime(new Date(from as string), timezone)
        : undefined,
      customTo: to ? fromZonedTime(new Date(to as string), timezone) : undefined
    }

    const stats = await summaryAnalyticsService(
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
    const userId = req.user?._id
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom: from
        ? fromZonedTime(new Date(from as string), timezone)
        : undefined,
      customTo: to ? fromZonedTime(new Date(to as string), timezone) : undefined
    }

    const chartData = await chartAnalyticsService(
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
    const userId = req.user?._id
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'

    const { preset, from, to } = req.query

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom: from
        ? fromZonedTime(new Date(from as string), timezone)
        : undefined,
      customTo: to ? fromZonedTime(new Date(to as string), timezone) : undefined
    }

    const pieChartData = await expensePieChartBreakdownService(
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

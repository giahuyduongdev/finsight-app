import { Request, Response } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { HTTPSTATUS } from '../config/http.config'
import { generateReportService } from '../services/report.service'
import { fromZonedTime } from 'date-fns-tz'
import { getUserId } from '../utils/getUserId.util'
import { container } from '../container'
import {
  toReportSettingResponse,
  toGenerateReportResponse,
  toOTPResponse
} from '../dtos'
import { parsePaginationQuery } from '../utils/query-parser.util'

// Get ReportService instance from DI container
const reportService = container.getReportService()

export const getAllReportsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)

    const pagination = parsePaginationQuery(req.query)

    const result = await reportService.findByUserId(userId, pagination)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Reports history fetched successfully',
      ...result
    })
  }
)

export const updateReportSettingController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = req.body

    const updatedReportSetting = await reportService.updateSettings(
      userId,
      body
    )

    return res
      .status(HTTPSTATUS.OK)
      .json(toReportSettingResponse(updatedReportSetting))
  }
)

export const generateReportController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const { from, to } = req.query
    const timezone = req.user?.timezone || 'UTC'
    const preferredCurrency = req.user?.preferredCurrency || 'USD'
    const fromDate = fromZonedTime(`${from}T00:00:00`, timezone as string)
    const toDate = fromZonedTime(`${to}T23:59:59`, timezone as string)

    const result = await generateReportService(
      userId,
      fromDate,
      toDate,
      timezone as string,
      preferredCurrency
    )

    if (!result) {
      return res
        .status(HTTPSTATUS.NOT_FOUND)
        .json(toOTPResponse('No transactions found for the specified period'))
    }

    return res.status(HTTPSTATUS.OK).json(toGenerateReportResponse(result))
  }
)

export const resendReportController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const reportId = req.params.reportId as string

    // Validate reportId format
    if (!reportId || !/^[0-9a-fA-F]{24}$/.test(reportId)) {
      return res
        .status(HTTPSTATUS.BAD_REQUEST)
        .json(toOTPResponse('Invalid report ID format'))
    }

    const result = await reportService.resendReport(userId, reportId)

    return res.status(HTTPSTATUS.OK).json(toOTPResponse(result.message))
  }
)

import { Request, Response } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { HTTPSTATUS } from '../config/http.config'
import { generateReportService } from '../services/report.service'
import { fromZonedTime } from 'date-fns-tz'
import { getUserId } from '../utils/getUserId.util'
import { container } from '../container'
import { toReportSettingResponse, toGenerateReportResponse } from '../dtos'
import { parsePaginationQuery } from '../utils/query-parser.util'
import { ResponseFormatter } from '../utils/responseFormatter.util'
import { BadRequestException, NotFoundException } from '../utils/errors'

// Get ReportService instance from DI container
const reportService = container.getReportService()

export const getAllReportsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)

    const pagination = parsePaginationQuery(req.query)

    const result = await reportService.findByUserId(userId, pagination)

    return res
      .status(HTTPSTATUS.OK)
      .json(ResponseFormatter.paginated(result.data, result.pagination, req))
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

    const response = toReportSettingResponse(updatedReportSetting)

    return res
      .status(HTTPSTATUS.OK)
      .json(
        ResponseFormatter.success(response.data, { message: response.message })
      )
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
      throw new NotFoundException(
        'No transactions found for the specified period'
      )
    }

    const response = toGenerateReportResponse(result)
    const { message, ...data } = response

    return res
      .status(HTTPSTATUS.OK)
      .json(ResponseFormatter.success(data, { message }))
  }
)

export const resendReportController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const reportId = req.params.reportId as string

    // Validate reportId format
    if (!reportId || !/^[0-9a-fA-F]{24}$/.test(reportId)) {
      throw new BadRequestException('Invalid report ID format')
    }

    const result = await reportService.resendReport(userId, reportId)

    return res
      .status(HTTPSTATUS.OK)
      .json(ResponseFormatter.success(null, { message: result.message }))
  }
)

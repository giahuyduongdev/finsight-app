import { Request, Response } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { HTTPSTATUS } from '../config/http.config'
import {
  generateReportService,
  getAllReportsService,
  updateReportSettingService
} from '../services/report.service'
import { updateReportSettingSchema } from '../validators/report.validator'
import { fromZonedTime } from 'date-fns-tz'

export const getAllReportsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id

    const pagination = {
      pageSize: parseInt(req.query.pageSize as string) || 20,
      pageNumber: parseInt(req.query.pageNumber as string) || 1
    }

    const result = await getAllReportsService(userId, pagination)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Reports history fetched successfully',
      ...result
    })
  }
)

export const updateReportSettingController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
    const body = updateReportSettingSchema.parse(req.body)

    const updatedReportSetting = await updateReportSettingService(userId, body)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Reports setting updated successfully',
      data: updatedReportSetting
    })
  }
)

export const generateReportController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
    const { from, to } = req.query
    const timezone = req.user?.timezone || 'UTC'
    const fromDate = fromZonedTime(`${from}T00:00:00`, timezone as string)
    const toDate = fromZonedTime(`${to}T23:59:59`, timezone as string)

    const result = await generateReportService(
      userId,
      fromDate,
      toDate,
      timezone as string
    )

    return res.status(HTTPSTATUS.OK).json({
      message: 'Report generated successfully',
      ...result
    })
  }
)

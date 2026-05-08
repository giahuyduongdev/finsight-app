import { IReportRepository } from './interfaces/report-repository.interface'
import ReportModel, {
  ReportDocument,
  ReportStatusEnum
} from '../models/report.model'
import { PaginationParams, PaginatedResult } from '../types/repository.types'

/**
 * Report Repository Implementation
 * Handles all report data access operations
 */
export class ReportRepository implements IReportRepository {
  /**
   * Create report record
   */
  async create(reportData: Partial<ReportDocument>): Promise<ReportDocument> {
    return await ReportModel.create(reportData)
  }

  /**
   * Find reports by user ID with pagination
   * Sorted by sentDate descending
   */
  async findByUserId(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<ReportDocument>> {
    const { pageSize, pageNumber } = pagination
    const skip = (pageNumber - 1) * pageSize

    const [reports, totalCount] = await Promise.all([
      ReportModel.find({ userId })
        .skip(skip)
        .limit(pageSize)
        .sort({ sentDate: -1 }),
      ReportModel.countDocuments({ userId })
    ])

    return {
      data: reports,
      pagination: {
        pageSize,
        pageNumber,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        skip
      }
    }
  }

  /**
   * Find report by period and user ID
   */
  async findByPeriod(
    userId: string,
    period: string
  ): Promise<ReportDocument | null> {
    return await ReportModel.findOne({ userId, period })
  }

  /**
   * Update report status
   */
  async updateStatus(
    reportId: string,
    status: ReportStatusEnum
  ): Promise<ReportDocument | null> {
    return await ReportModel.findByIdAndUpdate(
      reportId,
      { status },
      { new: true }
    )
  }
}

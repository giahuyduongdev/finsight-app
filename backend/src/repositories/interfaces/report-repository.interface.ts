import { ReportDocument, ReportStatusEnum } from '../../models/report.model'
import { PaginationParams, PaginatedResult } from '../../types/repository.type'

/**
 * Report Repository Interface
 * Defines contract for report data access operations
 */
export interface IReportRepository {
  /**
   * Create report record
   * @param reportData - Partial report data
   * @returns Created report document
   */
  create(reportData: Partial<ReportDocument>): Promise<ReportDocument>

  /**
   * Find reports by user ID with pagination
   * @param userId - User ID
   * @param pagination - Pagination parameters
   * @returns Paginated report results sorted by sentDate descending
   */
  findByUserId(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<ReportDocument>>

  /**
   * Find report by period and user ID
   * @param userId - User ID
   * @param period - Report period (e.g., "2024-01")
   * @returns Report document or null if not found
   */
  findByPeriod(userId: string, period: string): Promise<ReportDocument | null>

  /**
   * Update report status
   * @param reportId - Report ID
   * @param status - New report status
   * @returns Updated report document or null if not found
   */
  updateStatus(
    reportId: string,
    status: ReportStatusEnum
  ): Promise<ReportDocument | null>
}

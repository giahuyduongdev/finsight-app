/**
 * MockReportRepository
 * In-memory implementation of IReportRepository for testing
 */

import { IReportRepository } from '../../repositories/interfaces/report-repository.interface'
import { ReportDocument, ReportStatusEnum } from '../../models/report.model'
import mongoose from 'mongoose'
import { PaginatedResult } from '../../types/repository.types'

export class MockReportRepository implements IReportRepository {
  private reports: Map<string, ReportDocument> = new Map()
  private idCounter = 1

  async create(reportData: Partial<ReportDocument>): Promise<ReportDocument> {
    const id = new mongoose.Types.ObjectId()
    const report = {
      _id: id,
      userId: reportData.userId || new mongoose.Types.ObjectId(),
      period: reportData.period || '',
      sentDate: reportData.sentDate || new Date(),
      status: reportData.status || ReportStatusEnum.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Mock Mongoose document methods
      toObject: () => report,
      save: async () => report
    } as unknown as ReportDocument

    this.reports.set(id.toString(), report)
    return report
  }

  async findByUserId(
    userId: string,
    pagination: { pageSize: number; pageNumber: number }
  ): Promise<PaginatedResult<ReportDocument>> {
    const allReports = Array.from(this.reports.values()).filter(
      (r) => r.userId.toString() === userId
    )

    // Sort by sentDate descending
    const sorted = allReports.sort(
      (a, b) => b.sentDate.getTime() - a.sentDate.getTime()
    )

    const { pageSize, pageNumber } = pagination
    const skip = (pageNumber - 1) * pageSize
    const reports = sorted.slice(skip, skip + pageSize)
    const totalCount = sorted.length
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      data: reports,
      pagination: {
        pageSize,
        pageNumber,
        totalCount,
        totalPages,
        skip
      }
    }
  }

  async findByPeriod(
    userId: string,
    period: string
  ): Promise<ReportDocument | null> {
    const report = Array.from(this.reports.values()).find(
      (r) => r.userId.toString() === userId && r.period === period
    )
    return report || null
  }

  async updateStatus(
    reportId: string,
    status: ReportStatusEnum
  ): Promise<ReportDocument | null> {
    const report = this.reports.get(reportId)
    if (!report) return null

    report.status = status
    report.updatedAt = new Date()
    this.reports.set(reportId, report)
    return report
  }

  // Test helper methods
  clear(): void {
    this.reports.clear()
    this.idCounter = 1
  }

  getAll(): ReportDocument[] {
    return Array.from(this.reports.values())
  }

  getById(id: string): ReportDocument | undefined {
    return this.reports.get(id)
  }
}

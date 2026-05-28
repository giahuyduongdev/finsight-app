/**
 * ReportService Unit Tests
 */

import { ReportService } from '../../services/report.service'
import { MockReportRepository } from '../mocks/report-repository.mock'
import { MockReportSettingRepository } from '../mocks/report-setting-repository.mock'
import { NotFoundException } from '../../utils/errors'
import { ReportStatusEnum } from '../../models/report.model'
import { ReportFrequencyEnum } from '../../enums/report-frequency.enum'
import mongoose from 'mongoose'

describe('ReportService', () => {
  let service: ReportService
  let mockReportRepo: MockReportRepository
  let mockReportSettingRepo: MockReportSettingRepository

  beforeEach(() => {
    mockReportRepo = new MockReportRepository()
    mockReportSettingRepo = new MockReportSettingRepository()
    service = new ReportService(mockReportRepo, mockReportSettingRepo)
  })

  afterEach(() => {
    mockReportRepo.clear()
    mockReportSettingRepo.clear()
  })

  describe('findByUserId', () => {
    it('should return paginated reports for user', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      // Create test reports
      await mockReportRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        period: '2024-01',
        sentDate: new Date('2024-01-31'),
        status: ReportStatusEnum.SENT
      })
      await mockReportRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        period: '2024-02',
        sentDate: new Date('2024-02-28'),
        status: ReportStatusEnum.SENT
      })

      const result = await service.findByUserId(userId, {
        pageSize: 10,
        pageNumber: 1
      })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.totalCount).toBe(2)
      expect(result.pagination.pageSize).toBe(10)
      expect(result.pagination.pageNumber).toBe(1)
    })

    it('should return empty array when user has no reports', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      const result = await service.findByUserId(userId, {
        pageSize: 10,
        pageNumber: 1
      })

      expect(result.data).toHaveLength(0)
      expect(result.pagination.totalCount).toBe(0)
    })

    it('should sort reports by sentDate descending', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      await mockReportRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        period: '2024-01',
        sentDate: new Date('2024-01-31'),
        status: ReportStatusEnum.SENT
      })
      await mockReportRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        period: '2024-03',
        sentDate: new Date('2024-03-31'),
        status: ReportStatusEnum.SENT
      })
      await mockReportRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        period: '2024-02',
        sentDate: new Date('2024-02-28'),
        status: ReportStatusEnum.SENT
      })

      const result = await service.findByUserId(userId, {
        pageSize: 10,
        pageNumber: 1
      })

      expect(result.data[0].period).toBe('2024-03')
      expect(result.data[1].period).toBe('2024-02')
      expect(result.data[2].period).toBe('2024-01')
    })
  })

  describe('getSettings', () => {
    it('should return report settings when they exist', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      await mockReportSettingRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        isEnabled: true,
        frequency: ReportFrequencyEnum.MONTHLY
      })

      const result = await service.getSettings(userId)

      expect(result).toBeDefined()
      expect(result?.isEnabled).toBe(true)
      expect(result?.frequency).toBe(ReportFrequencyEnum.MONTHLY)
    })

    it('should return null when settings do not exist', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      const result = await service.getSettings(userId)

      expect(result).toBeNull()
    })
  })

  describe('updateSettings', () => {
    it('should update report settings successfully', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      await mockReportSettingRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        isEnabled: false,
        frequency: ReportFrequencyEnum.MONTHLY
      })

      const result = await service.updateSettings(userId, {
        isEnabled: true
      })

      expect(result.isEnabled).toBe(true)
    })

    it('should calculate nextReportDate when enabling', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      await mockReportSettingRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        isEnabled: false,
        frequency: ReportFrequencyEnum.MONTHLY,
        lastSentDate: new Date('2024-01-01')
      })

      const result = await service.updateSettings(userId, {
        isEnabled: true
      })

      expect(result.isEnabled).toBe(true)
      expect(result.nextReportDate).toBeDefined()
    })

    it('should throw NotFoundException when settings do not exist', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      await expect(
        service.updateSettings(userId, {
          isEnabled: true
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('findByPeriod', () => {
    it('should return report when found', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      await mockReportRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        period: '2024-01',
        sentDate: new Date('2024-01-31'),
        status: ReportStatusEnum.SENT
      })

      const result = await service.findByPeriod(userId, '2024-01')

      expect(result).toBeDefined()
      expect(result?.period).toBe('2024-01')
    })

    it('should return null when report not found', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      const result = await service.findByPeriod(userId, '2024-01')

      expect(result).toBeNull()
    })
  })

  describe('updateStatus', () => {
    it('should update report status successfully', async () => {
      const userId = new mongoose.Types.ObjectId().toString()

      const report = await mockReportRepo.create({
        userId: new mongoose.Types.ObjectId(userId),
        period: '2024-01',
        sentDate: new Date('2024-01-31'),
        status: ReportStatusEnum.PENDING
      })

      const result = await service.updateStatus(
        report._id.toString(),
        ReportStatusEnum.SENT
      )

      expect(result.status).toBe(ReportStatusEnum.SENT)
    })

    it('should throw NotFoundException when report not found', async () => {
      const reportId = new mongoose.Types.ObjectId().toString()

      await expect(
        service.updateStatus(reportId, ReportStatusEnum.SENT)
      ).rejects.toThrow(NotFoundException)
    })
  })
})

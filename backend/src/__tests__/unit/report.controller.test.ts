import { NextFunction, Request, Response } from 'express'
import { HTTPSTATUS } from '../../config/http.config'

const mockUpdateSettings = jest.fn()
const mockResendReport = jest.fn()
const mockEmit = jest.fn()
const mockTo = jest.fn(() => ({ emit: mockEmit }))
const mockGetIO = jest.fn(() => ({ to: mockTo }))
const mockLoggerWarn = jest.fn()

jest.mock('../../container', () => ({
  container: {
    getReportService: () => ({
      updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
      resendReport: (...args: unknown[]) => mockResendReport(...args)
    })
  }
}))

jest.mock('../../services/report.service', () => ({
  generateReportService: jest.fn()
}))

jest.mock('../../config/socket.config', () => ({
  getIO: () => mockGetIO()
}))

jest.mock('../../config/logger.config', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

jest.mock('../../utils/getUserId.util', () => ({
  getUserId: () => 'user-123'
}))

import {
  resendReportController,
  updateReportSettingController
} from '../../controllers/report.controller'

const createReportSetting = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'setting-123' },
  userId: { toString: () => 'user-123' },
  frequency: 'MONTHLY',
  isEnabled: true,
  lastSentDate: undefined,
  nextReportDate: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides
})

describe('report.controller', () => {
  let mockResponse: Partial<Response>
  let nextMock: jest.MockedFunction<NextFunction>
  let statusMock: jest.Mock
  let jsonMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    jsonMock = jest.fn()
    mockResponse = {
      json: jsonMock
    }
    statusMock = jest.fn().mockReturnValue(mockResponse)
    mockResponse.status = statusMock
    nextMock = jest.fn()
  })

  describe('updateReportSettingController', () => {
    it('emits report settings update event with changed fields after successful update', async () => {
      mockUpdateSettings.mockResolvedValue(createReportSetting())

      const mockRequest = {
        body: {
          isEnabled: true
        }
      } as Request

      await updateReportSettingController(
        mockRequest,
        mockResponse as Response,
        nextMock
      )

      expect(mockUpdateSettings).toHaveBeenCalledWith('user-123', {
        isEnabled: true
      })
      expect(mockTo).toHaveBeenCalledWith('user-123')
      expect(mockEmit).toHaveBeenCalledWith('report:settings-updated', {
        userId: 'user-123',
        changedFields: ['isEnabled'],
        reportSetting: expect.objectContaining({
          _id: 'setting-123',
          userId: 'user-123',
          isEnabled: true,
          frequency: 'MONTHLY'
        }),
        updatedAt: expect.any(String)
      })
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          _id: 'setting-123',
          userId: 'user-123',
          isEnabled: true,
          frequency: 'MONTHLY'
        }),
        meta: { message: 'Report settings retrieved successfully' }
      })
      expect(nextMock).not.toHaveBeenCalled()
    })

    it('does not fail the report settings response when socket emit fails', async () => {
      mockUpdateSettings.mockResolvedValue(createReportSetting())
      mockGetIO.mockImplementationOnce(() => {
        throw new Error('Socket unavailable')
      })

      const mockRequest = {
        body: {
          isEnabled: false
        }
      } as Request

      await updateReportSettingController(
        mockRequest,
        mockResponse as Response,
        nextMock
      )

      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ _id: 'setting-123' })
        })
      )
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '[APP:Report] Failed to emit report settings socket event',
        expect.objectContaining({
          userId: 'user-123',
          changedFields: ['isEnabled'],
          error: 'Socket unavailable'
        })
      )
      expect(nextMock).not.toHaveBeenCalled()
    })
  })

  describe('resendReportController', () => {
    it('emits report list update event after successful resend', async () => {
      mockResendReport.mockResolvedValue({
        message: 'Report resent successfully'
      })

      const mockRequest = {
        params: {
          reportId: '507f1f77bcf86cd799439011'
        }
      } as unknown as Request

      await resendReportController(
        mockRequest,
        mockResponse as Response,
        nextMock
      )

      expect(mockResendReport).toHaveBeenCalledWith(
        'user-123',
        '507f1f77bcf86cd799439011'
      )
      expect(mockTo).toHaveBeenCalledWith('user-123')
      expect(mockEmit).toHaveBeenCalledWith('report:list-updated', {
        userId: 'user-123',
        reason: 'resent',
        reportId: '507f1f77bcf86cd799439011',
        status: 'SENT',
        source: 'api',
        updatedAt: expect.any(String)
      })
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith({
        data: null,
        meta: { message: 'Report resent successfully' }
      })
      expect(nextMock).not.toHaveBeenCalled()
    })

    it('does not fail the resend response when lifecycle socket emit fails', async () => {
      mockResendReport.mockResolvedValue({
        message: 'Report resent successfully'
      })
      mockGetIO.mockImplementationOnce(() => {
        throw new Error('Socket unavailable')
      })

      const mockRequest = {
        params: {
          reportId: '507f1f77bcf86cd799439011'
        }
      } as unknown as Request

      await resendReportController(
        mockRequest,
        mockResponse as Response,
        nextMock
      )

      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith({
        data: null,
        meta: { message: 'Report resent successfully' }
      })
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '[APP:Report] Failed to emit report lifecycle socket event',
        expect.objectContaining({
          userId: 'user-123',
          reason: 'resent',
          reportId: '507f1f77bcf86cd799439011',
          status: 'SENT',
          source: 'api',
          error: 'Socket unavailable'
        })
      )
      expect(nextMock).not.toHaveBeenCalled()
    })
  })
})

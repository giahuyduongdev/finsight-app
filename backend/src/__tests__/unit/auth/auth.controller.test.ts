import { NextFunction, Request, Response } from 'express'
import { HTTPSTATUS } from '../../../config/http.config'

const mockLogoutAllService = jest.fn()
const mockRefreshTokenService = jest.fn()
const mockResetPasswordService = jest.fn()
const mockVerifyChangePasswordOTPService = jest.fn()
const mockVerifyChangeEmailOTPService = jest.fn()
const mockEmit = jest.fn()
const mockTo = jest.fn(() => ({ emit: mockEmit }))
const mockGetIO = jest.fn(() => ({ to: mockTo }))
const mockLoggerWarn = jest.fn()

jest.mock('../../../services/auth.service', () => ({
  logoutAllService: (...args: unknown[]) => mockLogoutAllService(...args),
  refreshTokenService: (...args: unknown[]) => mockRefreshTokenService(...args),
  resetPasswordService: (...args: unknown[]) =>
    mockResetPasswordService(...args),
  verifyChangePasswordOTPService: (...args: unknown[]) =>
    mockVerifyChangePasswordOTPService(...args),
  verifyChangeEmailOTPService: (...args: unknown[]) =>
    mockVerifyChangeEmailOTPService(...args)
}))

jest.mock('../../../config/socket.config', () => ({
  getIO: () => mockGetIO()
}))

jest.mock('../../../config/logger.config', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

jest.mock('../../../utils/getUserId.util', () => ({
  getUserId: () => 'user-123'
}))

import {
  logoutAllController,
  refreshTokenController,
  resetPasswordController,
  verifyChangeEmailOTPController,
  verifyChangePasswordOTPController
} from '../../../controllers/auth.controller'

describe('auth.controller', () => {
  let mockResponse: Partial<Response>
  let nextMock: jest.MockedFunction<NextFunction>
  let statusMock: jest.Mock
  let jsonMock: jest.Mock
  let clearCookieMock: jest.Mock
  let cookieMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    jsonMock = jest.fn()
    clearCookieMock = jest.fn()
    cookieMock = jest.fn()
    mockResponse = {
      cookie: cookieMock,
      clearCookie: clearCookieMock,
      json: jsonMock
    }
    statusMock = jest.fn().mockReturnValue(mockResponse)
    mockResponse.status = statusMock
    nextMock = jest.fn()
  })

  it('emits auth session revoked event after logout all succeeds', async () => {
    mockLogoutAllService.mockResolvedValue({
      message: 'Logged out from all devices successfully'
    })

    const mockRequest = {
      headers: {
        authorization: 'Bearer access-token'
      }
    } as unknown as Request

    await logoutAllController(mockRequest, mockResponse as Response, nextMock)

    expect(mockLogoutAllService).toHaveBeenCalledWith(
      'user-123',
      'access-token'
    )
    expect(mockTo).toHaveBeenCalledWith('user-123')
    expect(mockEmit).toHaveBeenCalledWith('auth:session-revoked', {
      userId: 'user-123',
      reason: 'logout-all',
      scope: 'all-sessions',
      redirectTo: '/',
      message: 'Your sessions were ended. Please sign in again',
      source: 'api',
      revokedAt: expect.any(String)
    })
    expect(clearCookieMock).toHaveBeenCalledWith(
      'refreshToken',
      expect.any(Object)
    )
    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(jsonMock).toHaveBeenCalledWith({
      data: null,
      meta: { message: 'Logged out from all devices successfully' }
    })
    expect(nextMock).not.toHaveBeenCalled()
  })

  it('sets replacement refresh cookie after refresh token rotation', async () => {
    mockRefreshTokenService.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 1784800000000
    })

    const mockRequest = {
      cookies: {
        refreshToken: 'old-refresh-token'
      },
      body: {}
    } as unknown as Request

    await refreshTokenController(
      mockRequest,
      mockResponse as Response,
      nextMock
    )

    expect(mockRefreshTokenService).toHaveBeenCalledWith('old-refresh-token')
    expect(cookieMock).toHaveBeenCalledWith(
      'refreshToken',
      'new-refresh-token',
      expect.objectContaining({
        httpOnly: true,
        path: '/'
      })
    )
    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(jsonMock).toHaveBeenCalledWith({
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: 1784800000000
      },
      meta: { message: 'Token refreshed successfully' }
    })
    expect(nextMock).not.toHaveBeenCalled()
  })

  it('does not fail logout all response when socket emit fails', async () => {
    mockLogoutAllService.mockResolvedValue({
      message: 'Logged out from all devices successfully'
    })
    mockGetIO.mockImplementationOnce(() => {
      throw new Error('Socket unavailable')
    })

    const mockRequest = {
      headers: {
        authorization: 'Bearer access-token'
      }
    } as unknown as Request

    await logoutAllController(mockRequest, mockResponse as Response, nextMock)

    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(jsonMock).toHaveBeenCalledWith({
      data: null,
      meta: { message: 'Logged out from all devices successfully' }
    })
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[APP:Auth] Failed to emit auth session revoked socket event',
      expect.objectContaining({
        userId: 'user-123',
        reason: 'logout-all',
        error: 'Socket unavailable'
      })
    )
    expect(nextMock).not.toHaveBeenCalled()
  })

  it('emits auth session revoked event after password change succeeds', async () => {
    mockVerifyChangePasswordOTPService.mockResolvedValue({
      message: 'Password changed successfully. Please login again'
    })

    const mockRequest = {
      body: {
        otp: '123456'
      }
    } as Request

    await verifyChangePasswordOTPController(
      mockRequest,
      mockResponse as Response,
      nextMock
    )

    expect(mockVerifyChangePasswordOTPService).toHaveBeenCalledWith(
      'user-123',
      { otp: '123456' }
    )
    expect(mockEmit).toHaveBeenCalledWith(
      'auth:session-revoked',
      expect.objectContaining({
        userId: 'user-123',
        reason: 'password-changed',
        message: 'Your password changed. Please sign in again'
      })
    )
    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(nextMock).not.toHaveBeenCalled()
  })

  it('emits auth session revoked event after email change succeeds', async () => {
    mockVerifyChangeEmailOTPService.mockResolvedValue({
      message: 'Email changed successfully. Please login again'
    })

    const mockRequest = {
      body: {
        otp: '123456'
      }
    } as Request

    await verifyChangeEmailOTPController(
      mockRequest,
      mockResponse as Response,
      nextMock
    )

    expect(mockVerifyChangeEmailOTPService).toHaveBeenCalledWith('user-123', {
      otp: '123456'
    })
    expect(mockEmit).toHaveBeenCalledWith(
      'auth:session-revoked',
      expect.objectContaining({
        userId: 'user-123',
        reason: 'email-changed',
        message: 'Your email changed. Please sign in again'
      })
    )
    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(nextMock).not.toHaveBeenCalled()
  })

  it('emits auth session revoked event after password reset succeeds', async () => {
    mockResetPasswordService.mockResolvedValue({
      userId: 'user-456',
      message: 'Password reset successfully. Please login again'
    })

    const mockRequest = {
      body: {
        email: 'user@example.com',
        resetToken: 'reset-token',
        newPassword: 'NewPassword123!'
      }
    } as Request

    await resetPasswordController(
      mockRequest,
      mockResponse as Response,
      nextMock
    )

    expect(mockResetPasswordService).toHaveBeenCalledWith(mockRequest.body)
    expect(mockTo).toHaveBeenCalledWith('user-456')
    expect(mockEmit).toHaveBeenCalledWith(
      'auth:session-revoked',
      expect.objectContaining({
        userId: 'user-456',
        reason: 'password-reset',
        message: 'Your password was reset. Please sign in again'
      })
    )
    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(jsonMock).toHaveBeenCalledWith({
      data: null,
      meta: { message: 'Password reset successfully. Please login again' }
    })
    expect(nextMock).not.toHaveBeenCalled()
  })
})

import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import {
  forgotPasswordService,
  loginService,
  logoutAllService,
  logoutService,
  oauthCallbackService,
  refreshTokenService,
  registerOTPService,
  registerService,
  resendForgotPasswordOTPService,
  resendRegisterVerifyOTPService,
  resetPasswordService,
  verifyForgotPasswordOTPService,
  verifyRegisterOTPService,
  changePasswordRequestService,
  verifyChangePasswordOTPService,
  resendChangePasswordOTPService,
  changeEmailRequestService,
  verifyChangeEmailOTPService,
  resendChangeEmailOTPService
} from '../services/auth.service'
import { Env } from '../config/env.config'
import ms from 'ms'
import { UnauthorizedException } from '../utils/errors/index'
import {
  sanitizeUser,
  toTokenRefreshResponse,
  toAuthSuccessResponse
} from '../dtos'
import { logger } from '../config/logger.config'
import { getUserId } from '../utils/getUserId.util'
import crypto from 'crypto'
import { ResponseFormatter } from '../utils/responseFormatter.util'
import { normalizeTimezone } from '../utils/timezone.util'
import { emitAuthSessionRevoked } from '../utils/auth-socket.util'

const messageOnlyResponse = (message: string) =>
  ResponseFormatter.success(null, { message })

export const registerController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const result = await registerService(body)
    return res.status(HTTPSTATUS.CREATED).json(
      ResponseFormatter.success(result, {
        message: 'User registered successfully'
      })
    )
  }
)

export const registerOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const result = await registerOTPService(body)
    return res
      .status(HTTPSTATUS.ACCEPTED)
      .json(messageOnlyResponse(result.message))
  }
)

export const verifyRegisterOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const result = await verifyRegisterOTPService(body)
    const { message, ...data } = result
    return res
      .status(HTTPSTATUS.OK)
      .json(ResponseFormatter.success(data, { message }))
  }
)

export const resendRegisterOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const result = await resendRegisterVerifyOTPService(body)
    return res.status(HTTPSTATUS.OK).json(messageOnlyResponse(result.message))
  }
)

export const forgotPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const result = await forgotPasswordService(body)
    return res
      .status(HTTPSTATUS.ACCEPTED)
      .json(messageOnlyResponse(result.message))
  }
)

export const verifyForgotPasswordOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const result = await verifyForgotPasswordOTPService(body)
    const { message, ...data } = result
    return res
      .status(HTTPSTATUS.CREATED)
      .json(ResponseFormatter.success(data, { message }))
  }
)

export const resendForgotPasswordOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const result = await resendForgotPasswordOTPService(body)
    return res.status(HTTPSTATUS.OK).json(messageOnlyResponse(result.message))
  }
)

export const resetPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body

    const result = await resetPasswordService(body)
    const response = res
      .status(HTTPSTATUS.OK)
      .json(messageOnlyResponse(result.message))

    if (result.userId) {
      emitAuthSessionRevoked(result.userId, 'password-reset')
    }

    return response
  }
)

export const loginController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = { ...req.body }
    const userAgent = req.headers['user-agent'] || ''
    const { user, accessToken, refreshToken, expiresAt, reportSetting } =
      await loginService(body, userAgent)

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: ms(Env.JWT_REFRESH_EXPIRES_IN as ms.StringValue),
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost'
    })

    const response = toAuthSuccessResponse({
      user: sanitizeUser(user),
      accessToken,
      expiresAt,
      reportSetting
    })
    const { message, ...data } = response

    return res
      .status(HTTPSTATUS.OK)
      .json(ResponseFormatter.success(data, { message }))
  }
)

export const refreshTokenController = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken

    const result = await refreshTokenService(refreshToken)

    const response = toTokenRefreshResponse(result)
    const { message, ...data } = response

    return res
      .status(HTTPSTATUS.OK)
      .json(ResponseFormatter.success(data, { message }))
  }
)

export const logoutController = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken
    const accessToken = req.headers.authorization?.split(' ')[1] // lấy access token từ header
    if (!accessToken)
      throw new UnauthorizedException('Access token is required')

    await logoutService(refreshToken, accessToken)

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost'
    })

    return res
      .status(HTTPSTATUS.OK)
      .json(messageOnlyResponse('Logged out successfully'))
  }
)

export const logoutAllController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const accessToken = req.headers.authorization?.split(' ')[1]
    if (!accessToken)
      throw new UnauthorizedException('Access token is required')

    await logoutAllService(userId, accessToken)

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost'
    })

    const response = res
      .status(HTTPSTATUS.OK)
      .json(messageOnlyResponse('Logged out from all devices successfully'))

    emitAuthSessionRevoked(userId, 'logout-all')

    return response
  }
)

export const oauthRedirectController = asyncHandler(
  async (req: Request, res: Response) => {
    const { provider } = req.params
    const timezone = (req.query.tz as string) || 'UTC'

    // Generate CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex')

    // Store CSRF token in secure, HttpOnly cookie
    res.cookie('oauth_csrf', csrfToken, {
      httpOnly: true,
      secure: Env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
      domain: Env.NODE_ENV === 'production' ? undefined : 'localhost'
    })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: Env.AUTH0_CLIENT_ID,
      redirect_uri: Env.AUTH0_CALLBACK_URL,
      scope: 'openid profile email',
      connection: provider === 'github' ? 'github' : 'google-oauth2',
      state: Buffer.from(JSON.stringify({ timezone, csrfToken })).toString(
        'base64'
      )
    })

    const url = `https://${Env.AUTH0_DOMAIN}/authorize?${params}`
    res.redirect(url)
  }
)

export const oauthCallbackController = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, error, state } = req.query // Hứng thêm cả lỗi từ Auth0 nếu có

    // Kiểm tra nếu user từ chối đăng nhập hoặc lỗi từ Auth0
    if (error || !code) {
      logger.warn('[APP:Auth] Auth0 Error:', error)
      return res.redirect(`${Env.FRONTEND_ORIGIN}/?error=auth_failed`)
    }

    // Decode timezone và csrfToken từ state
    let timezone = 'UTC'
    let csrfTokenFromState = ''
    try {
      const decoded = JSON.parse(
        Buffer.from(state as string, 'base64').toString()
      )
      const normalizedTimezone = normalizeTimezone(decoded.timezone)
      csrfTokenFromState = decoded.csrfToken || ''

      if (decoded.timezone && !normalizedTimezone) {
        logger.warn('[APP:Auth] Invalid timezone received:', {
          timezone: decoded.timezone
        })
      }
      timezone = normalizedTimezone || 'UTC'
    } catch (e) {
      logger.warn('[APP:Auth] State decoding failed:', e)
      return res.redirect(`${Env.FRONTEND_ORIGIN}/?error=invalid_state`)
    }

    // Validate CSRF token
    const csrfTokenFromCookie = req.cookies?.oauth_csrf
    if (!csrfTokenFromCookie || csrfTokenFromCookie !== csrfTokenFromState) {
      logger.warn('[APP:Auth] CSRF token mismatch', {
        hasCookieToken: !!csrfTokenFromCookie,
        hasStateToken: !!csrfTokenFromState,
        tokensMatch: csrfTokenFromCookie === csrfTokenFromState
      })
      return res.redirect(
        `${Env.FRONTEND_ORIGIN}/?error=csrf_validation_failed`
      )
    }

    // Clear CSRF cookie after validation
    res.clearCookie('oauth_csrf', {
      httpOnly: true,
      secure: Env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: Env.NODE_ENV === 'production' ? undefined : 'localhost'
    })

    const result = await oauthCallbackService(code as string, timezone) // ← truyền timezone

    // Thiết lập Cookie RefreshToken (Quá chuẩn!)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: Env.NODE_ENV === 'production',
      sameSite: 'lax', // Dùng 'lax' sẽ tốt hơn cho việc redirect giữa các domain khác nhau
      maxAge: ms(Env.JWT_REFRESH_EXPIRES_IN as ms.StringValue),
      path: '/',
      domain: Env.NODE_ENV === 'production' ? undefined : 'localhost'
    })

    res.redirect(`${Env.FRONTEND_ORIGIN}/oauth-callback`)
  }
)

export const changePasswordRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = req.body
    const result = await changePasswordRequestService(userId, body)
    return res.status(HTTPSTATUS.OK).json(messageOnlyResponse(result.message))
  }
)

export const verifyChangePasswordOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = req.body
    const result = await verifyChangePasswordOTPService(userId, body)
    const response = res
      .status(HTTPSTATUS.OK)
      .json(messageOnlyResponse(result.message))
    emitAuthSessionRevoked(userId, 'password-changed')
    return response
  }
)

export const resendChangePasswordOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const result = await resendChangePasswordOTPService(userId)
    return res.status(HTTPSTATUS.OK).json(messageOnlyResponse(result.message))
  }
)

export const changeEmailRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = req.body
    const result = await changeEmailRequestService(userId, body)
    return res.status(HTTPSTATUS.OK).json(messageOnlyResponse(result.message))
  }
)

export const verifyChangeEmailOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = req.body
    const result = await verifyChangeEmailOTPService(userId, body)
    const response = res
      .status(HTTPSTATUS.OK)
      .json(messageOnlyResponse(result.message))
    emitAuthSessionRevoked(userId, 'email-changed')
    return response
  }
)

export const resendChangeEmailOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const result = await resendChangeEmailOTPService(userId)
    return res.status(HTTPSTATUS.OK).json(messageOnlyResponse(result.message))
  }
)

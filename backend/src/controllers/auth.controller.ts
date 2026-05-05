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
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resendOTPSchema,
  resetPasswordSchema,
  verifyForgotOTPSchema,
  verifyOTPSchema,
  changePasswordRequestSchema,
  verifyChangePasswordOTPSchema,
  changeEmailRequestSchema,
  verifyChangeEmailOTPSchema
} from '../validators/auth.validator'
import { Env } from '../config/env.config'
import ms from 'ms'
import { UnauthorizedException } from '../utils/errors/index'
import { sanitizeUser } from '../dtos/user.dtos'
import { logger } from '../config/logger.config'
import { getUserId } from '../utils/getUserId.util'
import crypto from 'crypto'

export const registerController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = registerSchema.parse(req.body)
    const result = await registerService(body)
    return res.status(HTTPSTATUS.CREATED).json({
      message: 'User registered successfully',
      data: result
    })
  }
)

export const registerOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = registerSchema.parse(req.body)
    const result = await registerOTPService(body)
    return res.status(HTTPSTATUS.ACCEPTED).json({ message: result.message })
  }
)

export const verifyRegisterOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = verifyOTPSchema.parse(req.body)
    const result = await verifyRegisterOTPService(body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const resendRegisterOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = resendOTPSchema.parse(req.body)
    const result = await resendRegisterVerifyOTPService(body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const forgotPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = forgotPasswordSchema.parse(req.body)
    const result = await forgotPasswordService(body)
    return res.status(HTTPSTATUS.ACCEPTED).json({ message: result.message })
  }
)

export const verifyForgotPasswordOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = verifyForgotOTPSchema.parse(req.body)
    const result = await verifyForgotPasswordOTPService(body)
    return res.status(HTTPSTATUS.CREATED).json(result)
  }
)

export const resendForgotPasswordOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = resendOTPSchema.parse(req.body)
    const result = await resendForgotPasswordOTPService(body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const resetPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = resetPasswordSchema.parse(req.body)

    const result = await resetPasswordService(body)

    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const loginController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = loginSchema.parse({ ...req.body })
    const userAgent = req.headers['user-agent'] || ''
    const { user, accessToken, refreshToken, expiresAt, reportSetting } =
      await loginService(body, userAgent)

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS khi production
      sameSite: 'strict',
      maxAge: ms(Env.JWT_REFRESH_EXPIRES_IN as ms.StringValue)
    })

    return res.status(HTTPSTATUS.OK).json({
      message: 'User logged in successfully',
      user: sanitizeUser(user),
      accessToken,
      expiresAt,
      reportSetting
    })
  }
)

export const refreshTokenController = asyncHandler(
  async (req: Request, res: Response) => {
    const { refreshToken } = refreshTokenSchema.parse({
      refreshToken: req.cookies?.refreshToken ?? req.body?.refreshToken
    })

    const result = await refreshTokenService(refreshToken)

    return res.status(HTTPSTATUS.OK).json({
      message: 'Token refreshed successfully',
      ...result
    })
  }
)

export const logoutController = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken =
      req.cookies?.refreshToken || refreshTokenSchema.parse(req.body)
    const accessToken = req.headers.authorization?.split(' ')[1] // lấy access token từ header
    if (!accessToken)
      throw new UnauthorizedException('Access token is required')

    await logoutService(refreshToken, accessToken)

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // PHẢI khớp với lúc res.cookie
      path: '/' // Thường mặc định là '/', nhưng thêm vào cho chắc chắn
    })

    return res.status(HTTPSTATUS.OK).json({
      message: 'Logged out successfully'
    })
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
      sameSite: 'strict',
      path: '/'
    })

    return res.status(HTTPSTATUS.OK).json({
      message: 'Logged out from all devices successfully'
    })
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
      path: '/'
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
      logger.warn('Auth0 Error:', error)
      return res.redirect(`${Env.FRONTEND_ORIGIN}/?error=auth_failed`)
    }

    // Decode timezone và csrfToken từ state
    let timezone = 'UTC'
    let csrfTokenFromState = ''
    try {
      const decoded = JSON.parse(
        Buffer.from(state as string, 'base64').toString()
      )
      timezone = decoded.timezone || 'UTC'
      csrfTokenFromState = decoded.csrfToken || ''

      // Validate timezone against IANA database
      if (timezone !== 'UTC') {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone })
        } catch {
          logger.warn('Invalid timezone received:', { timezone })
          timezone = 'UTC'
        }
      }
    } catch (e) {
      logger.warn('State decoding failed:', e)
      return res.redirect(`${Env.FRONTEND_ORIGIN}/?error=invalid_state`)
    }

    // Validate CSRF token
    const csrfTokenFromCookie = req.cookies?.oauth_csrf
    if (!csrfTokenFromCookie || csrfTokenFromCookie !== csrfTokenFromState) {
      logger.warn('CSRF token mismatch', {
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
      path: '/'
    })

    const result = await oauthCallbackService(code as string, timezone) // ← truyền timezone

    // Thiết lập Cookie RefreshToken (Quá chuẩn!)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: Env.NODE_ENV === 'production',
      sameSite: 'lax', // Dùng 'lax' sẽ tốt hơn cho việc redirect giữa các domain khác nhau
      maxAge: ms(Env.JWT_REFRESH_EXPIRES_IN as ms.StringValue)
    })

    // 6. Build URL Redirect dùng URLSearchParams cho an toàn
    const queryParams = new URLSearchParams({
      accessToken: result.accessToken,
      expiresAt: result.expiresAt?.toString() || ''
    })

    res.redirect(
      `${Env.FRONTEND_ORIGIN}/oauth-callback?${queryParams.toString()}`
    )
  }
)

export const changePasswordRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = changePasswordRequestSchema.parse(req.body)
    const result = await changePasswordRequestService(userId, body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const verifyChangePasswordOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = verifyChangePasswordOTPSchema.parse(req.body)
    const result = await verifyChangePasswordOTPService(userId, body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const resendChangePasswordOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const result = await resendChangePasswordOTPService(userId)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const changeEmailRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = changeEmailRequestSchema.parse(req.body)
    const result = await changeEmailRequestService(userId, body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const verifyChangeEmailOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const body = verifyChangeEmailOTPSchema.parse(req.body)
    const result = await verifyChangeEmailOTPService(userId, body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

export const resendChangeEmailOTPController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const result = await resendChangeEmailOTPService(userId)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

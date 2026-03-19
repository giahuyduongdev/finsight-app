import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema
} from '../validators/auth.validator'
import {
  loginService,
  logoutAllService,
  logoutService,
  refreshTokenService,
  registerService
} from '../services/auth.service'
import { Env } from '../config/env.config'
import ms from 'ms'
import { UnauthorizedException } from '../utils/app-error'

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
      user,
      accessToken,
      expiresAt,
      reportSetting
    })
  }
)

export const refreshTokenController = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken =
      req.cookies?.refreshToken || refreshTokenSchema.parse(req.body)

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

    res.clearCookie('refreshToken')

    return res.status(HTTPSTATUS.OK).json({
      message: 'Logged out successfully'
    })
  }
)

export const logoutAllController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id
    const accessToken = req.headers.authorization?.split(' ')[1]
    if (!accessToken)
      throw new UnauthorizedException('Access token is required')

    await logoutAllService(userId, accessToken)

    res.clearCookie('refreshToken')

    return res.status(HTTPSTATUS.OK).json({
      message: 'Logged out from all devices successfully'
    })
  }
)

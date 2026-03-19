import mongoose from 'mongoose'
import UserModel from '../models/user.model'
import { NotFoundException, UnauthorizedException } from '../utils/app-error'
import {
  LoginSchemaType,
  RefreshTokenSchemaType,
  RegisterSchemaType
} from '../validators/auth.validator'
import ReportSettingModel, {
  ReportFrequencyEnum
} from '../models/report-setting.model'
import { calculateNextReportDate } from '../utils/helper'
import { refreshTokenSignOptions, signJwtToken } from '../utils/jwt'
import RefreshTokenModel from '../models/refresh-token.model'
import ms from 'ms'
import { Env } from '../config/env.config'
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import { redis } from '../config/redis.config'

export const registerService = async (body: RegisterSchemaType) => {
  const { email } = body

  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      const existingUser = await UserModel.findOne({ email }).session(session)
      if (existingUser) throw new UnauthorizedException('User already exists')

      const newUser = new UserModel({
        ...body
      })

      await newUser.save({ session })

      const reportSetting = new ReportSettingModel({
        userId: newUser._id,
        frequency: ReportFrequencyEnum.MONTHLY,
        isEnabled: true,
        lastSentDate: null,
        nextReportDate: calculateNextReportDate()
      })
      await reportSetting.save({ session })
      return { user: newUser.omitPassword() }
    })
  } catch (error) {
    throw error
  } finally {
    await session.endSession()
  }
}

export const loginService = async (
  body: LoginSchemaType,
  userAgent: string
) => {
  const { email, password, timezone } = body
  const user = await UserModel.findOne({ email })
  if (!user) throw new NotFoundException('Email/password not found')

  const isValidPassword = await user.comparePassword(password)
  if (!isValidPassword) {
    throw new UnauthorizedException('Invalid email/password')
  }

  user.timezone = timezone || user.timezone || 'UTC'
  await user.save()

  const { token: accessToken, expiresAt } = signJwtToken({ userId: user.id })

  const { token: refreshToken } = signJwtToken(
    { userId: user.id },
    refreshTokenSignOptions
  )

  await RefreshTokenModel.deleteMany({
    userId: user.id,
    $or: [{ isRevoked: true }, { expiresAt: { $lt: new Date() } }]
  })

  await RefreshTokenModel.findOneAndUpdate(
    { token: refreshToken },
    {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(
        Date.now() + ms(Env.JWT_REFRESH_EXPIRES_IN as ms.StringValue)
      ),
      userAgent: userAgent || '',
      isRevoked: false
    },
    { upsert: true, new: true }
  )

  const reportSetting = await ReportSettingModel.findOne(
    {
      userId: user.id
    },
    {
      _id: 1,
      frequency: 1,
      isEnabled: 1
    }
  ).lean()

  return {
    user: user.omitPassword(),
    accessToken: accessToken,
    refreshToken: refreshToken,
    expiresAt,
    reportSetting
  }
}

export const refreshTokenService = async (token: string) => {
  // 1. Verify refresh token
  const decoded = jwt.verify(token, Env.JWT_REFRESH_SECRET) as JwtPayload
  if (!decoded || !decoded.userId) {
    throw new UnauthorizedException('Invalid refresh token')
  }

  // 2. Kiểm tra DB
  const refreshToken = await RefreshTokenModel.findOne({
    token,
    isRevoked: false,
    expiresAt: { $gt: new Date() } // chưa hết hạn
  })

  if (!refreshToken) {
    throw new UnauthorizedException('Refresh token is invalid or expired')
  }

  // 3. Kiểm tra user còn tồn tại không
  const user = await UserModel.findById(decoded.userId)
  if (!user) throw new NotFoundException('User not found')

  // 4. Tạo access token mới
  const { token: accessToken, expiresAt } = signJwtToken({ userId: user.id })

  return {
    accessToken,
    expiresAt
  }
}

export const logoutService = async (
  refreshToken: string,
  accessToken: string
) => {
  // 1. Tìm và revoke refresh token
  const token = await RefreshTokenModel.findOneAndUpdate(
    { token: refreshToken, isRevoked: false },
    { isRevoked: true }
  )

  if (!token) {
    throw new NotFoundException('Refresh token not found or already revoked')
  }
  // 2. Blacklist access token trong Redis
  const decoded = jwt.decode(accessToken) as JwtPayload
  const ttl = decoded.exp! - Math.floor(Date.now() / 1000) // giây còn lại

  if (ttl > 0) {
    await redis.set(`blacklist:${accessToken}`, 'revoked', 'EX', ttl)
  }

  return { message: 'Logged out successfully' }
}

export const logoutAllService = async (userId: string, accessToken: string) => {
  // 1. Revoke tất cả refresh token của user
  await RefreshTokenModel.updateMany(
    { userId, isRevoked: false },
    { isRevoked: true }
  )

  // 2. Blacklist access token hiện tại
  const decoded = jwt.decode(accessToken) as JwtPayload
  const ttl = decoded.exp! - Math.floor(Date.now() / 1000)

  if (ttl > 0) {
    await redis.set(`blacklist:${accessToken}`, 'revoked', 'EX', ttl)
  }

  return { message: 'Logged out from all devices successfully' }
}

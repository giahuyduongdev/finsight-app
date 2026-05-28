import mongoose from 'mongoose'
import UserModel from '../models/user.model'
import {
  BadRequestException,
  ConflictException,
  InternalServerException,
  NotFoundException,
  UnauthorizedException
} from '../utils/errors/index'
import {
  RegisterResponse,
  OTPVerificationResult,
  LoginResponse,
  OAuthCallbackResult,
  Auth0Profile
} from '../types/auth.type'
import {
  ForgotPasswordSchemaType,
  LoginSchemaType,
  RegisterSchemaType,
  ResendOTPSchemaType,
  ResetPasswordSchemaType,
  VerifyForgotOTPSchemaType,
  VerifyOTPSchemaType,
  ChangePasswordRequestSchemaType,
  VerifyChangePasswordOTPSchemaType,
  ChangeEmailRequestSchemaType,
  VerifyChangeEmailOTPSchemaType
} from '../validators/auth.validator'
import ReportSettingModel from '../models/report-setting.model'
import { ReportFrequencyEnum } from '../enums/report-frequency.enum'
import { calculateNextReportDate } from '../utils/dates/index'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../utils/jwt.util'
import RefreshTokenModel from '../models/refresh-token.model'
import ms from 'ms'
import { Env } from '../config/env.config'
import jwt, { JwtPayload } from 'jsonwebtoken'
import {
  OTP_CONFIG,
  redis,
  REDIS_KEYS,
  REDIS_TTL
} from '../config/redis.config'
import { ErrorCodeEnum } from '../enums/error-code.enum'
import { generateSecureOTP } from '../utils/generate-otp.util'
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendChangePasswordEmail,
  sendChangeEmailOldOTP,
  sendChangeEmailNewOTP
} from '../mailers/auth.mailer'
import crypto from 'crypto'
import { encrypt, decrypt } from '../utils/encryption.util'
import {
  hashOtp,
  hashRefreshToken,
  hashResetToken
} from '../utils/secure-hash.util'

export const registerService = async (
  body: RegisterSchemaType
): Promise<RegisterResponse> => {
  const { email } = body
  const session = await mongoose.startSession()
  let result: RegisterResponse | null = null

  try {
    await session.withTransaction(async () => {
      const existingUser = await UserModel.findOne({ email }).session(session)
      if (existingUser) {
        throw new ConflictException(
          'Email already exists',
          ErrorCodeEnum.AUTH_EMAIL_ALREADY_EXISTS
        )
      }

      const newUser = new UserModel({ ...body })
      await newUser.save({ session })

      await new ReportSettingModel({
        userId: newUser._id,
        frequency: ReportFrequencyEnum.MONTHLY,
        isEnabled: true,
        lastSentDate: null,
        nextReportDate: calculateNextReportDate()
      }).save({ session })

      result = { user: newUser.omitPassword() }
    })

    if (!result) throw new InternalServerException('Failed to create user')
    return result
  } finally {
    await session.endSession()
  }
}

export const registerOTPService = async (body: RegisterSchemaType) => {
  const { name, email, password } = body

  // 1. Check email đang pending verification
  const isPending = await redis.exists(REDIS_KEYS.registerPending(email))
  if (isPending) {
    const canResend = !(await redis.exists(REDIS_KEYS.registerResend(email)))
    const remainingTime = await redis.ttl(REDIS_KEYS.registerOtp(email))

    throw new BadRequestException(
      'Email is pending verification',
      ErrorCodeEnum.AUTH_EMAIL_PENDING_VERIFICATION,
      {
        canResend,
        remainingTime: remainingTime > 0 ? remainingTime : 0
      }
    )
  }

  // 2. Check email đã tồn tại trong MongoDB
  const existingUser = await UserModel.findOne({ email })
  if (existingUser) {
    throw new ConflictException(
      'Email already exists',
      ErrorCodeEnum.AUTH_EMAIL_ALREADY_EXISTS
    )
  }

  // 3. Generate OTP
  const otp = generateSecureOTP()
  const hashedOtp = hashOtp(otp)
  const pendingUser = { name, email, password }

  // 4. Lưu Redis pipeline — 1 round-trip
  const results = await redis
    .pipeline()
    .setex(
      REDIS_KEYS.registerPending(email),
      REDIS_TTL.PENDING,
      JSON.stringify(pendingUser)
    )
    .setex(REDIS_KEYS.registerOtp(email), REDIS_TTL.OTP, hashedOtp)
    .setex(REDIS_KEYS.registerResend(email), REDIS_TTL.RESEND, '1')
    .setex(REDIS_KEYS.registerAttempts(email), REDIS_TTL.OTP, '0')
    .exec()

  if (!results) throw new InternalServerException('Failed to save OTP data')

  // 5. Gửi email
  await sendVerificationEmail({ email, username: name, otpCode: otp })

  return {
    message: 'OTP sent to your email. Please verify within 5 minutes'
  }
}

type RegisterResult = RegisterResponse

export const verifyRegisterOTPService = async (
  body: VerifyOTPSchemaType
): Promise<OTPVerificationResult> => {
  const { email, otp } = body

  const storedOTP = await redis.get(REDIS_KEYS.registerOtp(email))
  if (!storedOTP) {
    throw new BadRequestException(
      'OTP has expired. Please register again.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  const hashedInputOTP = hashOtp(otp)

  if (storedOTP !== hashedInputOTP) {
    const failKey = REDIS_KEYS.registerAttempts(email)
    const currentFails = await redis.incr(failKey)

    // Nếu là lần sai đầu tiên, set TTL cho biến đếm
    if (currentFails === 1) {
      await redis.expire(failKey, REDIS_TTL.OTP_ATTEMPTS)
    }

    // Nếu đã sai quá số lần cho phép (5 lần)
    if (currentFails >= OTP_CONFIG.MAX_ATTEMPTS) {
      // Xóa luôn mã OTP hiện tại & xóa biến đếm
      await redis
        .pipeline()
        .del(REDIS_KEYS.registerOtp(email))
        .del(failKey)
        .exec()

      throw new BadRequestException(
        'Too many invalid attempts. Your OTP has been revoked. Please request a new one.',
        ErrorCodeEnum.AUTH_OTP_INVALID // Hoặc bạn có thể tự tạo mã lỗi mới như AUTH_TOO_MANY_ATTEMPTS
      )
    }

    // Nếu vẫn còn lượt thử, báo lỗi kèm số lần còn lại
    const attemptsLeft = OTP_CONFIG.MAX_ATTEMPTS - currentFails
    throw new BadRequestException(
      `Invalid OTP. You have ${attemptsLeft} attempts left.`,
      ErrorCodeEnum.AUTH_OTP_INVALID
    )
  }

  const pendingData = await redis.get(REDIS_KEYS.registerPending(email))
  if (!pendingData) {
    throw new BadRequestException(
      'Registration session expired. Please register again.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  const { name, password } = JSON.parse(pendingData)

  const session = await mongoose.startSession()
  let result: RegisterResult | null = null // ← type rõ ràng

  try {
    await session.withTransaction(async () => {
      const newUser = new UserModel({ name, email, password })
      await newUser.save({ session })

      await new ReportSettingModel({
        userId: newUser._id,
        frequency: ReportFrequencyEnum.MONTHLY,
        isEnabled: true,
        lastSentDate: null,
        nextReportDate: calculateNextReportDate()
      }).save({ session })

      result = { user: newUser.omitPassword() } as RegisterResult // ← cast rõ ràng
    })

    if (!result) throw new InternalServerException('Failed to create user')

    await redis
      .pipeline()
      .del(REDIS_KEYS.registerOtp(email))
      .del(REDIS_KEYS.registerPending(email))
      .del(REDIS_KEYS.registerResend(email))
      .del(REDIS_KEYS.registerAttempts(email))
      .exec()

    return {
      message: 'Account verified successfully',
      ...(result as RegisterResult) // ← cast trước khi spread
    }
  } finally {
    await session.endSession()
  }
}

export const resendRegisterVerifyOTPService = async (
  body: ResendOTPSchemaType
) => {
  const { email } = body

  // 1. Check còn trong thời gian chặn resend không
  const isBlocked = await redis.exists(REDIS_KEYS.registerResend(email))
  if (isBlocked) {
    const remainingTime = await redis.ttl(REDIS_KEYS.registerResend(email))
    throw new BadRequestException(
      'Please wait before requesting a new OTP',
      ErrorCodeEnum.AUTH_OTP_TOO_MANY_REQUESTS,
      { remainingTime: remainingTime > 0 ? remainingTime : 0 }
    )
  }

  // 2. Check email đã tồn tại trong MongoDB chưa
  const existingUser = await UserModel.findOne({ email })
  if (existingUser) {
    throw new ConflictException(
      'Email already exists',
      ErrorCodeEnum.AUTH_EMAIL_ALREADY_EXISTS
    )
  }

  // 3. Check còn pending không
  const pendingData = await redis.get(REDIS_KEYS.registerPending(email))
  if (!pendingData) {
    throw new BadRequestException(
      'Registration session expired. Please register again.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  const { name } = JSON.parse(pendingData)

  // 4. Generate OTP mới + reset TTL
  const otp = generateSecureOTP()
  const hashedOtp = hashOtp(otp)

  const results = await redis
    .pipeline()
    .setex(REDIS_KEYS.registerOtp(email), REDIS_TTL.OTP, hashedOtp)
    .setex(REDIS_KEYS.registerResend(email), REDIS_TTL.RESEND, '1')
    .expire(REDIS_KEYS.registerPending(email), REDIS_TTL.PENDING) // reset TTL pending
    .exec()

  if (!results) throw new InternalServerException('Failed to resend OTP')

  // 5. Gửi email
  await sendVerificationEmail({ email, username: name, otpCode: otp })

  return {
    message: 'New OTP sent to your email. Please verify within 5 minutes'
  }
}

export const forgotPasswordService = async (body: ForgotPasswordSchemaType) => {
  const { email } = body

  // Check resend block
  const isBlocked = await redis.exists(REDIS_KEYS.forgotResend(email))
  if (isBlocked) {
    // Vẫn trả về 200, không tiết lộ gì thêm
    return {
      message: 'If this email is registered, you will receive an OTP shortly.'
    }
  }

  // Luôn trả về 200, không tiết lộ email có tồn tại không
  const user = await UserModel.findOne({ email })
  if (!user) {
    // Âm thầm kết thúc — không throw error
    return {
      message: 'If this email is registered, you will receive an OTP shortly.'
    }
  }

  const otp = generateSecureOTP()
  const hashedOtp = hashOtp(otp)

  const results = await redis
    .pipeline()
    .setex(REDIS_KEYS.forgotOtp(email), REDIS_TTL.FORGOT_OTP, hashedOtp)
    .setex(REDIS_KEYS.forgotResend(email), REDIS_TTL.FORGOT_RESEND, '1')
    .setex(REDIS_KEYS.forgotAttempts(email), REDIS_TTL.FORGOT_OTP, '0') // ← đếm số lần sai
    .exec()

  if (!results) throw new InternalServerException('Failed to process request')

  await sendPasswordResetEmail({
    email,
    username: user.name,
    otpCode: otp
  })

  return {
    message: 'If this email is registered, you will receive an OTP shortly.'
  }
}

export const verifyForgotPasswordOTPService = async (
  body: VerifyForgotOTPSchemaType
) => {
  const { email, otp } = body

  // 1. Check OTP tồn tại không
  const storedOTP = await redis.get(REDIS_KEYS.forgotOtp(email))
  if (!storedOTP) {
    throw new BadRequestException(
      'OTP has expired. Please request a new one.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  // 2. Check số lần sai
  const attemptsKey = REDIS_KEYS.forgotAttempts(email)
  const attempts = parseInt((await redis.get(attemptsKey)) || '0')

  if (attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    // Xóa OTP, bắt request lại từ đầu
    await redis
      .pipeline()
      .del(REDIS_KEYS.forgotOtp(email))
      .del(attemptsKey)
      .exec()

    throw new BadRequestException(
      'Too many failed attempts. Please request a new OTP.',
      ErrorCodeEnum.AUTH_OTP_TOO_MANY_REQUESTS
    )
  }

  const hashedInputOTP = hashOtp(otp)

  // 3. Check OTP đúng không
  if (storedOTP !== hashedInputOTP) {
    // Tăng số lần sai
    await redis.incr(attemptsKey)
    const remainingAttempts = OTP_CONFIG.MAX_ATTEMPTS - (attempts + 1)

    throw new BadRequestException(
      `Invalid OTP. You have ${remainingAttempts} attempts remaining.`,
      ErrorCodeEnum.AUTH_OTP_INVALID,
      { remainingAttempts }
    )
  }

  // 4. OTP đúng → Generate resetToken
  const resetToken = crypto.randomBytes(32).toString('hex')

  const hashedResetToken = hashResetToken(resetToken)

  await redis
    .pipeline()
    .setex(
      REDIS_KEYS.resetToken(email),
      REDIS_TTL.RESET_TOKEN,
      hashedResetToken
    )
    .del(REDIS_KEYS.forgotOtp(email))
    .del(attemptsKey)
    .exec()

  return {
    message: 'OTP verified successfully',
    resetToken
  }
}

export const resendForgotPasswordOTPService = async (
  body: ForgotPasswordSchemaType
) => {
  const { email } = body

  // 1. Check còn trong thời gian chặn resend không (Cooldown)
  const isBlocked = await redis.exists(REDIS_KEYS.forgotResend(email))
  if (isBlocked) {
    const remainingTime = await redis.ttl(REDIS_KEYS.forgotResend(email))
    throw new BadRequestException(
      'Please wait before requesting a new OTP',
      ErrorCodeEnum.AUTH_OTP_TOO_MANY_REQUESTS,
      { remainingTime: remainingTime > 0 ? remainingTime : 0 }
    )
  }

  // 2. Check user có tồn tại không (Bảo mật: Chống dò quét - Anti Enumeration)
  const user = await UserModel.findOne({ email })
  if (!user) {
    // Không ném lỗi NotFoundException ở đây để hacker không biết email có tồn tại hay không
    return {
      message: 'If your email is registered, a new OTP has been sent.'
    }
  }

  // 3. Generate OTP mới + Hash để lưu trữ an toàn
  const otp = generateSecureOTP()
  const hashedOtp = hashOtp(otp)

  // 4. Cập nhật Redis bằng pipeline + Xóa lịch sử nhập sai
  const results = await redis
    .pipeline()
    // Fix: dùng FORGOT_OTP và FORGOT_RESEND thay vì OTP và RESEND
    .setex(REDIS_KEYS.forgotOtp(email), REDIS_TTL.FORGOT_OTP, hashedOtp)
    .setex(REDIS_KEYS.forgotResend(email), REDIS_TTL.FORGOT_RESEND, '1')
    .del(REDIS_KEYS.forgotAttempts(email)) // Reset lại số lần nhập sai cho mã mới
    .exec()

  if (!results) throw new InternalServerException('Failed to resend OTP')

  // 5. Gửi email
  await sendPasswordResetEmail({ email, username: user.name, otpCode: otp })

  return {
    message: 'If your email is registered, a new OTP has been sent.'
  }
}

export const resetPasswordService = async (body: ResetPasswordSchemaType) => {
  const { email, resetToken, newPassword } = body

  // 1. Check xem phiên đổi mật khẩu còn hạn không (trong Redis)
  const storedHashedToken = await redis.get(REDIS_KEYS.resetToken(email))
  if (!storedHashedToken) {
    throw new BadRequestException(
      'Reset session expired. Please request a new OTP.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  // 2. BẢO MẬT: So sánh token
  const hashedInputToken = hashResetToken(resetToken)

  if (storedHashedToken !== hashedInputToken) {
    throw new BadRequestException(
      'Invalid reset token.',
      ErrorCodeEnum.AUTH_TOKEN_INVALID
    )
  }

  // 3. Lấy User từ DB lên trước để kiểm tra mật khẩu cũ
  const user = await UserModel.findOne({ email })
  if (!user) {
    throw new NotFoundException('User not found')
  }

  // 4. KIỂM TRA MẬT KHẨU TRÙNG LẶP
  // Bạn sử dụng hàm compare tương tự như bên Login nhé (ví dụ user.comparePassword hoặc bcrypt.compare)
  // Giả sử bạn có hàm giải mã/so sánh mật khẩu tên là compareValue(plain, hashed)
  const isValidPassword = await user.comparePassword(newPassword)

  if (isValidPassword) {
    throw new BadRequestException(
      'New password must be different from the old password.',
      ErrorCodeEnum.AUTH_PASSWORD_MUST_BE_DIFFERENT
    )
  }

  // 5. Mọi thứ hợp lệ -> Hash mật khẩu mới và cập nhật
  user.password = newPassword
  await user.save() // Dùng lệnh save() lưu trực tiếp object user vừa tìm được ở Bước 3

  // 6. Dọn dẹp chiến trường
  await Promise.all([
    redis.del(REDIS_KEYS.resetToken(email)),
    RefreshTokenModel.deleteMany({ userId: user._id })
  ])

  return {
    message: 'Password reset successfully. Please login again.'
  }
}

export const loginService = async (
  body: LoginSchemaType,
  userAgent: string
): Promise<LoginResponse> => {
  const { email, password, timezone } = body
  const user = await UserModel.findOne({ email })
  if (!user) throw new NotFoundException('Email/password not found')

  const isValidPassword = await user.comparePassword(password)
  if (!isValidPassword) {
    throw new UnauthorizedException('Invalid email/password')
  }

  user.timezone = timezone || user.timezone || 'UTC'
  await user.save()

  const { token: accessToken, expiresAt } = signAccessToken({ userId: user.id })

  const { token: refreshToken } = signRefreshToken({ userId: user.id })
  const refreshTokenHash = hashRefreshToken(refreshToken)

  await RefreshTokenModel.deleteMany({
    userId: user.id,
    $or: [{ isRevoked: true }, { expiresAt: { $lt: new Date() } }]
  })

  await RefreshTokenModel.findOneAndUpdate(
    { token: refreshTokenHash },
    {
      userId: user.id,
      token: refreshTokenHash,
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
    reportSetting: reportSetting
      ? {
          _id: reportSetting._id.toString(),
          frequency: reportSetting.frequency,
          isEnabled: reportSetting.isEnabled
        }
      : null
  }
}

export const refreshTokenService = async (token: string) => {
  // 1. Verify refresh token
  let decoded
  try {
    decoded = verifyRefreshToken(token)
  } catch {
    throw new UnauthorizedException('Invalid or expired refresh token')
  }

  if (!decoded?.userId) {
    throw new UnauthorizedException('Invalid refresh token')
  }

  // 2. Kiểm tra DB
  const tokenHash = hashRefreshToken(token)
  let refreshToken = await RefreshTokenModel.findOne({
    token: tokenHash,
    isRevoked: false,
    expiresAt: { $gt: new Date() } // chưa hết hạn
  })

  if (!refreshToken) {
    refreshToken = await RefreshTokenModel.findOne({
      token,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    })

    if (refreshToken) {
      refreshToken.token = tokenHash
      await refreshToken.save()
    }
  }

  if (!refreshToken) {
    throw new UnauthorizedException('Refresh token is invalid or expired')
  }

  // 3. Kiểm tra user còn tồn tại không
  const user = await UserModel.findById(decoded.userId)
  if (!user) throw new NotFoundException('User not found')

  // 4. Tạo access token mới
  const { token: accessToken, expiresAt } = signAccessToken({ userId: user.id })

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
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const token = await RefreshTokenModel.findOneAndUpdate(
    { token: { $in: [refreshTokenHash, refreshToken] }, isRevoked: false },
    { token: refreshTokenHash, isRevoked: true }
  )

  if (!token) {
    throw new NotFoundException('Refresh token not found or already revoked')
  }
  // 2. Blacklist access token trong Redis
  const decoded = jwt.decode(accessToken) as JwtPayload | null

  if (decoded && typeof decoded.exp === 'number') {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000) // giây còn lại

    if (ttl > 0) {
      await redis.set(`blacklist:${accessToken}`, 'revoked', 'EX', ttl)
    }
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
  const decoded = jwt.decode(accessToken) as JwtPayload | null

  if (decoded && typeof decoded.exp === 'number') {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000)

    if (ttl > 0) {
      await redis.set(`blacklist:${accessToken}`, 'revoked', 'EX', ttl)
    }
  }

  return { message: 'Logged out from all devices successfully' }
}

export const createRefreshToken = async (
  userId: string,
  userAgent: string = ''
): Promise<string> => {
  // 1. Tạo Refresh Token bằng hàm JWT có sẵn của bạn
  const { token: refreshToken } = signRefreshToken({ userId })
  const refreshTokenHash = hashRefreshToken(refreshToken)

  // 2. Tính toán thời gian hết hạn để lưu DB (khớp với thời hạn của token)
  const expiresAt = new Date(
    Date.now() + ms(Env.JWT_REFRESH_EXPIRES_IN as ms.StringValue)
  )

  // 3. Dọn dẹp token rác của user này
  await RefreshTokenModel.deleteMany({
    userId,
    $or: [{ isRevoked: true }, { expiresAt: { $lt: new Date() } }]
  })

  // 4. Lưu DB với cơ chế phòng thủ Upsert
  await RefreshTokenModel.findOneAndUpdate(
    { token: refreshTokenHash },
    {
      userId,
      token: refreshTokenHash,
      expiresAt,
      userAgent,
      isRevoked: false
    },
    { upsert: true, new: true }
  )

  // 5. Trả về token
  return refreshToken
}

export const oauthCallbackService = async (
  code: string,
  timezone: string = 'UTC'
): Promise<OAuthCallbackResult> => {
  // 1. Đổi code → tokens từ Auth0
  const tokenController = new AbortController()
  const tokenTimeout = setTimeout(() => tokenController.abort(), 10000) // 10s timeout

  try {
    const tokenResponse = await fetch(
      `https://${Env.AUTH0_DOMAIN}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: Env.AUTH0_CLIENT_ID,
          client_secret: Env.AUTH0_CLIENT_SECRET,
          code,
          redirect_uri: Env.AUTH0_CALLBACK_URL
        }),
        signal: tokenController.signal
      }
    )

    clearTimeout(tokenTimeout)

    if (!tokenResponse.ok) {
      throw new BadRequestException(
        'Invalid Auth0 code or authorization failed'
      )
    }

    const { access_token } = (await tokenResponse.json()) as {
      access_token: string
    }

    // 2. Lấy profile từ Auth0
    const profileController = new AbortController()
    const profileTimeout = setTimeout(() => profileController.abort(), 10000) // 10s timeout

    const profileResponse = await fetch(
      `https://${Env.AUTH0_DOMAIN}/userinfo`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: profileController.signal
      }
    )

    clearTimeout(profileTimeout)

    if (!profileResponse.ok) {
      throw new BadRequestException('Failed to fetch user profile from Auth0')
    }

    const profile = (await profileResponse.json()) as Auth0Profile

    // 3. Tìm/Tạo/Liên kết user
    let user = await UserModel.findOne({ auth0Ids: profile.sub })

    if (!user) {
      user = await UserModel.findOne({ email: profile.email })

      if (user) {
        let needsSave = false
        if (!user.auth0Ids?.includes(profile.sub)) {
          user.auth0Ids = [...(user.auth0Ids || []), profile.sub]
          needsSave = true
        }
        if (user.timezone === 'UTC' && timezone !== 'UTC') {
          user.timezone = timezone
          needsSave = true
        }
        if (needsSave) await user.save()
      } else {
        user = await UserModel.create({
          email: profile.email,
          name: profile.name,
          profilePicture: profile.picture,
          password: crypto.randomUUID(),
          timezone,
          auth0Ids: [profile.sub]
        })
        await ReportSettingModel.create({ userId: user._id, isEnabled: false })
      }
    } else {
      // User đã tồn tại qua auth0Ids → cập nhật timezone nếu cần
      // Nếu múi giờ gửi lên khác với múi giờ đang lưu trong DB thì mới update
      if (timezone && user.timezone !== timezone) {
        user.timezone = timezone
        await user.save()
      }
    }

    // 4. Tạo JWT
    const { token: accessToken, expiresAt } = signAccessToken({
      userId: user.id
    })
    const refreshToken = await createRefreshToken(user.id)

    return { accessToken, expiresAt, refreshToken, user }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BadRequestException('OAuth request timed out')
    }
    throw error
  }
}

export const changePasswordRequestService = async (
  userId: string,
  body: ChangePasswordRequestSchemaType
) => {
  const { oldPassword, newPassword } = body

  // 1. Lấy User từ DB
  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  // 2. Xác thực mật khẩu cũ
  const isValidPassword = await user.comparePassword(oldPassword)
  if (!isValidPassword) {
    throw new BadRequestException(
      'Incorrect old password',
      ErrorCodeEnum.AUTH_UNAUTHORIZED_ACCESS
    )
  }

  // 3. Kiểm tra mật khẩu mới khác mật khẩu cũ
  const isSamePassword = await user.comparePassword(newPassword)
  if (isSamePassword) {
    throw new BadRequestException(
      'New password must be different from the old password',
      ErrorCodeEnum.AUTH_PASSWORD_MUST_BE_DIFFERENT
    )
  }

  // 4. Generate OTP
  const otp = generateSecureOTP()
  const hashedOtp = hashOtp(otp)

  // 5. Lưu vào Redis - MÃ HÓA mật khẩu mới trước khi lưu
  const encryptedPassword = await encrypt(newPassword)

  await redis
    .pipeline()
    .setex(
      REDIS_KEYS.changePasswordOtp(user.email),
      REDIS_TTL.CHANGE_PASSWORD_OTP,
      hashedOtp
    )
    .setex(
      REDIS_KEYS.changePasswordPending(user.email),
      REDIS_TTL.CHANGE_PASSWORD_OTP,
      encryptedPassword
    )
    .setex(
      REDIS_KEYS.changePasswordResend(user.email),
      REDIS_TTL.CHANGE_PASSWORD_RESEND,
      '1'
    )
    .setex(
      REDIS_KEYS.changePasswordAttempts(user.email),
      REDIS_TTL.CHANGE_PASSWORD_OTP,
      '0'
    )
    .exec()

  // 6. Gửi Email
  await sendChangePasswordEmail({
    email: user.email,
    username: user.name,
    otpCode: otp
  })

  return {
    message: 'Verification code sent to your email.'
  }
}

export const verifyChangePasswordOTPService = async (
  userId: string,
  body: VerifyChangePasswordOTPSchemaType
) => {
  const { otp } = body

  // 1. Lấy User
  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  const email = user.email

  // 2. Kiểm tra OTP trong Redis
  const storedOtp = await redis.get(REDIS_KEYS.changePasswordOtp(email))
  if (!storedOtp) {
    throw new BadRequestException(
      'OTP has expired or is invalid',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  // 3. Kiểm tra số lần thử
  const attemptsKey = REDIS_KEYS.changePasswordAttempts(email)
  const currentAttempts = parseInt((await redis.get(attemptsKey)) || '0')

  if (currentAttempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    await redis
      .pipeline()
      .del(REDIS_KEYS.changePasswordOtp(email))
      .del(REDIS_KEYS.changePasswordPending(email))
      .del(attemptsKey)
      .exec()

    throw new BadRequestException(
      'Too many failed attempts. Please request a new OTP.',
      ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS
    )
  }

  // 4. So sánh OTP
  const hashedInputOtp = hashOtp(otp)
  if (storedOtp !== hashedInputOtp) {
    await redis.incr(attemptsKey)
    const remaining = OTP_CONFIG.MAX_ATTEMPTS - (currentAttempts + 1)
    throw new BadRequestException(
      `Invalid OTP. You have ${remaining} attempts left.`,
      ErrorCodeEnum.AUTH_OTP_INVALID,
      { remainingAttempts: remaining }
    )
  }

  // 5. Lấy mật khẩu mới từ Redis và GIẢI MÃ
  const encryptedPassword = await redis.get(
    REDIS_KEYS.changePasswordPending(email)
  )
  if (!encryptedPassword) {
    throw new BadRequestException(
      'Change password session expired',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  let newPassword: string
  try {
    newPassword = await decrypt(encryptedPassword)
  } catch {
    // Decryption failed - clear session and force restart
    await Promise.all([
      redis.del(REDIS_KEYS.changePasswordOtp(email)),
      redis.del(REDIS_KEYS.changePasswordPending(email)),
      redis.del(REDIS_KEYS.changePasswordResend(email)),
      redis.del(attemptsKey)
    ])
    throw new BadRequestException(
      'Session data corrupted. Please start over.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  // 6. Cập nhật Database
  user.password = newPassword
  await user.save()

  // 7. Dọn dẹp Redis & Đăng xuất các phiên khác
  await Promise.all([
    redis.del(REDIS_KEYS.changePasswordOtp(email)),
    redis.del(REDIS_KEYS.changePasswordPending(email)),
    redis.del(REDIS_KEYS.changePasswordResend(email)),
    redis.del(attemptsKey),
    RefreshTokenModel.deleteMany({ userId: user._id }) // Đăng xuất tất cả các phiên
  ])

  return {
    message: 'Password changed successfully. Please login again.'
  }
}

export const resendChangePasswordOTPService = async (userId: string) => {
  // 1. Lấy User
  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  const email = user.email

  // 2. Check cooldown
  const isBlocked = await redis.exists(REDIS_KEYS.changePasswordResend(email))
  if (isBlocked) {
    const remainingTime = await redis.ttl(
      REDIS_KEYS.changePasswordResend(email)
    )
    throw new BadRequestException(
      'Please wait before requesting a new OTP',
      ErrorCodeEnum.AUTH_OTP_TOO_MANY_REQUESTS,
      { remainingTime: remainingTime > 0 ? remainingTime : 0 }
    )
  }

  // 3. Check session còn hạn không (phải còn pending password thì mới cho resend)
  const pendingPassword = await redis.get(
    REDIS_KEYS.changePasswordPending(email)
  )
  if (!pendingPassword) {
    throw new BadRequestException(
      'Change password session expired. Please start over.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  // 4. Generate OTP mới
  const otp = generateSecureOTP()
  const hashedOtp = hashOtp(otp)

  // 5. Cập nhật Redis
  await redis
    .pipeline()
    .setex(
      REDIS_KEYS.changePasswordOtp(email),
      REDIS_TTL.CHANGE_PASSWORD_OTP,
      hashedOtp
    )
    .setex(
      REDIS_KEYS.changePasswordResend(email),
      REDIS_TTL.CHANGE_PASSWORD_RESEND,
      '1'
    )
    .del(REDIS_KEYS.changePasswordAttempts(email))
    .exec()

  // 6. Gửi Email
  await sendChangePasswordEmail({
    email,
    username: user.name,
    otpCode: otp
  })

  return {
    message: 'New verification code sent to your email.'
  }
}

export const changeEmailRequestService = async (
  userId: string,
  body: ChangeEmailRequestSchemaType
) => {
  const { newEmail } = body

  // 1. Lấy User từ DB
  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  // 2. Kiểm tra email mới khác email cũ
  if (newEmail === user.email) {
    throw new BadRequestException(
      'New email must be different from the current email',
      ErrorCodeEnum.AUTH_EMAIL_ALREADY_EXISTS // Có thể dùng mã lỗi khác nếu cần
    )
  }

  // 3. Kiểm tra email mới đã có người dùng chưa
  const existingUser = await UserModel.findOne({ email: newEmail })
  if (existingUser) {
    throw new BadRequestException(
      'Email is already in use by another account',
      ErrorCodeEnum.AUTH_EMAIL_ALREADY_EXISTS
    )
  }

  // 4. Generate TWO OTPs
  const otpOld = generateSecureOTP()
  const otpNew = generateSecureOTP()
  const hashedOtpOld = hashOtp(otpOld)
  const hashedOtpNew = hashOtp(otpNew)

  // 5. Lưu vào Redis
  await redis
    .pipeline()
    .setex(
      REDIS_KEYS.changeEmailOtpOld(userId),
      REDIS_TTL.CHANGE_EMAIL_OTP,
      hashedOtpOld
    )
    .setex(
      REDIS_KEYS.changeEmailOtpNew(userId),
      REDIS_TTL.CHANGE_EMAIL_OTP,
      hashedOtpNew
    )
    .setex(
      REDIS_KEYS.changeEmailPending(userId),
      REDIS_TTL.CHANGE_EMAIL_OTP,
      newEmail
    )
    .setex(
      REDIS_KEYS.changeEmailResend(userId),
      REDIS_TTL.CHANGE_EMAIL_RESEND,
      '1'
    )
    .setex(
      REDIS_KEYS.changeEmailAttempts(userId),
      REDIS_TTL.CHANGE_EMAIL_OTP,
      '0'
    )
    .exec()

  // 6. Gửi Email (Cả 2 hòm thư)
  await Promise.all([
    sendChangeEmailOldOTP({
      email: user.email,
      username: user.name,
      otpCode: otpOld
    }),
    sendChangeEmailNewOTP({
      email: newEmail,
      username: user.name,
      otpCode: otpNew
    })
  ])

  return {
    message: 'Verification codes sent to both your old and new email addresses.'
  }
}

export const verifyChangeEmailOTPService = async (
  userId: string,
  body: VerifyChangeEmailOTPSchemaType
) => {
  const { oldEmailOtp, newEmailOtp } = body

  // 1. Lấy User
  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  // 2. Kiểm tra OTPs trong Redis
  const [storedOtpOld, storedOtpNew] = await Promise.all([
    redis.get(REDIS_KEYS.changeEmailOtpOld(userId)),
    redis.get(REDIS_KEYS.changeEmailOtpNew(userId))
  ])

  if (!storedOtpOld || !storedOtpNew) {
    throw new BadRequestException(
      'Verification session has expired or is invalid',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  // 3. Kiểm tra số lần thử
  const attemptsKey = REDIS_KEYS.changeEmailAttempts(userId)
  const currentAttempts = parseInt((await redis.get(attemptsKey)) || '0')

  if (currentAttempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    await redis
      .pipeline()
      .del(REDIS_KEYS.changeEmailOtpOld(userId))
      .del(REDIS_KEYS.changeEmailOtpNew(userId))
      .del(REDIS_KEYS.changeEmailPending(userId))
      .del(attemptsKey)
      .exec()

    throw new BadRequestException(
      'Too many failed attempts. Please request new codes.',
      ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS
    )
  }

  // 4. So sánh OTPs
  const hashedOld = hashOtp(oldEmailOtp)
  const hashedNew = hashOtp(newEmailOtp)

  const isOldValid = storedOtpOld === hashedOld
  const isNewValid = storedOtpNew === hashedNew

  if (!isOldValid || !isNewValid) {
    await redis.incr(attemptsKey)
    const remaining = OTP_CONFIG.MAX_ATTEMPTS - (currentAttempts + 1)

    let errorMsg = 'Invalid verification codes.'
    if (!isOldValid && !isNewValid) errorMsg = 'Both codes are invalid.'
    else if (!isOldValid)
      errorMsg = 'Authorization code for old email is invalid.'
    else if (!isNewValid)
      errorMsg = 'Verification code for new email is invalid.'

    throw new BadRequestException(
      `${errorMsg} You have ${remaining} attempts left.`,
      ErrorCodeEnum.AUTH_OTP_INVALID,
      { remainingAttempts: remaining }
    )
  }

  // 5. Lấy email mới từ Redis
  const newEmail = await redis.get(REDIS_KEYS.changeEmailPending(userId))
  if (!newEmail) {
    throw new BadRequestException(
      'Change email session expired',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  // 6. Cập nhật Database
  user.email = newEmail
  await user.save()

  // 6.1. Thu hồi toàn bộ session cũ (vì email là định danh đăng nhập đã thay đổi)
  await RefreshTokenModel.deleteMany({ userId: user._id })

  // 7. Dọn dẹp Redis OTP
  await Promise.all([
    redis.del(REDIS_KEYS.changeEmailOtpOld(userId)),
    redis.del(REDIS_KEYS.changeEmailOtpNew(userId)),
    redis.del(REDIS_KEYS.changeEmailPending(userId)),
    redis.del(REDIS_KEYS.changeEmailResend(userId)),
    redis.del(attemptsKey)
  ])

  return {
    message: 'Email updated successfully.'
  }
}

export const resendChangeEmailOTPService = async (userId: string) => {
  // 1. Lấy User
  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  // 2. Check cooldown
  const isBlocked = await redis.exists(REDIS_KEYS.changeEmailResend(userId))
  if (isBlocked) {
    const remainingTime = await redis.ttl(REDIS_KEYS.changeEmailResend(userId))
    throw new BadRequestException(
      'Please wait before requesting new codes',
      ErrorCodeEnum.AUTH_OTP_TOO_MANY_REQUESTS,
      { remainingTime: remainingTime > 0 ? remainingTime : 0 }
    )
  }

  // 3. Check session còn hạn không
  const pendingEmail = await redis.get(REDIS_KEYS.changeEmailPending(userId))
  if (!pendingEmail) {
    throw new BadRequestException(
      'Change email session expired. Please start over.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  // 4. Generate OTPs mới
  const otpOld = generateSecureOTP()
  const otpNew = generateSecureOTP()
  const hashedOtpOld = hashOtp(otpOld)
  const hashedOtpNew = hashOtp(otpNew)

  // 5. Cập nhật Redis
  await redis
    .pipeline()
    .setex(
      REDIS_KEYS.changeEmailOtpOld(userId),
      REDIS_TTL.CHANGE_EMAIL_OTP,
      hashedOtpOld
    )
    .setex(
      REDIS_KEYS.changeEmailOtpNew(userId),
      REDIS_TTL.CHANGE_EMAIL_OTP,
      hashedOtpNew
    )
    .setex(
      REDIS_KEYS.changeEmailResend(userId),
      REDIS_TTL.CHANGE_EMAIL_RESEND,
      '1'
    )
    .del(REDIS_KEYS.changeEmailAttempts(userId))
    .exec()

  // 6. Gửi Email (Cả 2 hòm thư)
  await Promise.all([
    sendChangeEmailOldOTP({
      email: user.email,
      username: user.name,
      otpCode: otpOld
    }),
    sendChangeEmailNewOTP({
      email: pendingEmail,
      username: user.name,
      otpCode: otpNew
    })
  ])

  return {
    message:
      'New verification codes sent to both your old and new email addresses.'
  }
}

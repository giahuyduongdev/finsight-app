import mongoose from 'mongoose'
import UserModel, { UserDocument } from '../models/user.model'
import {
  BadRequestException,
  ConflictException,
  InternalServerException,
  NotFoundException,
  UnauthorizedException
} from '../utils/errors/index'
import {
  ForgotPasswordSchemaType,
  LoginSchemaType,
  RefreshTokenSchemaType,
  RegisterSchemaType,
  ResendOTPSchemaType,
  ResetPasswordSchemaType,
  VerifyForgotOTPSchemaType,
  VerifyOTPSchemaType
} from '../validators/auth.validator'
import ReportSettingModel, {
  ReportFrequencyEnum
} from '../models/report-setting.model'
import { calculateNextReportDate } from '../utils/dates/index'
import { refreshTokenSignOptions, signJwtToken } from '../utils/jwt.util'
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
import { hashValue } from '../utils/bcrypt.util'
import { generateSecureOTP } from '../utils/generate-otp.util'
import {
  sendPasswordResetEmail,
  sendVerificationEmail
} from '../mailers/auth.mailer'
import crypto from 'crypto'

export const registerService = async (body: RegisterSchemaType) => {
  const { email } = body
  const session = await mongoose.startSession()
  let result: { user: Omit<UserDocument, 'password'> } | null = null

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

  // 3. Hash password + generate OTP
  const hashedPassword = await hashValue(password)
  const otp = generateSecureOTP()
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')
  const pendingUser = { name, email, password: hashedPassword }

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
    message: 'OTP sent to your email. Please verify within 5 minutes.'
  }
}

type RegisterResult = {
  user: Omit<UserDocument, 'password'>
}

export const verifyRegisterOTPService = async (body: VerifyOTPSchemaType) => {
  const { email, otp } = body

  const storedOTP = await redis.get(REDIS_KEYS.registerOtp(email))
  if (!storedOTP) {
    throw new BadRequestException(
      'OTP has expired. Please register again.',
      ErrorCodeEnum.AUTH_OTP_EXPIRED
    )
  }

  const hashedInputOTP = crypto.createHash('sha256').update(otp).digest('hex')

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
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')

  const results = await redis
    .pipeline()
    .setex(REDIS_KEYS.registerOtp(email), REDIS_TTL.OTP, otp)
    .setex(REDIS_KEYS.registerResend(email), REDIS_TTL.RESEND, '1')
    .expire(REDIS_KEYS.registerPending(email), REDIS_TTL.PENDING) // reset TTL pending
    .exec()

  if (!results) throw new InternalServerException('Failed to resend OTP')

  // 5. Gửi email
  await sendVerificationEmail({ email, username: name, otpCode: otp })

  return {
    message: 'New OTP sent to your email. Please verify within 5 minutes.'
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
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')

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

  const hashedInputOTP = crypto.createHash('sha256').update(otp).digest('hex')

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

  const hashedResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex')

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
  const otp = generateSecureOTP() // Dùng lại hàm tạo OTP của bạn
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')

  // 4. Cập nhật Redis bằng pipeline + Xóa lịch sử nhập sai
  const results = await redis
    .pipeline()
    .setex(REDIS_KEYS.forgotOtp(email), REDIS_TTL.OTP, hashedOtp)
    .setex(REDIS_KEYS.forgotResend(email), REDIS_TTL.RESEND, '1')
    .del(REDIS_KEYS.forgotAttempts(email)) // Reset lại số lần nhập sai cho mã mới
    .exec()

  if (!results) throw new InternalServerException('Failed to resend OTP')

  // 5. Gửi email
  // (Giả sử bạn có hàm sendForgotPasswordEmail tương tự hàm sendVerificationEmail)
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
  const hashedInputToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex')

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

export const createRefreshToken = async (
  userId: string,
  userAgent: string = ''
): Promise<string> => {
  // 1. Tạo Refresh Token bằng hàm JWT có sẵn của bạn
  const { token: refreshToken } = signJwtToken(
    { userId },
    refreshTokenSignOptions
  )

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
    { token: refreshToken },
    {
      userId,
      token: refreshToken,
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
) => {
  // 1. Đổi code → tokens từ Auth0
  const tokenResponse = await fetch(`https://${Env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: Env.AUTH0_CLIENT_ID,
      client_secret: Env.AUTH0_CLIENT_SECRET,
      code,
      redirect_uri: Env.AUTH0_CALLBACK_URL
    })
  })

  if (!tokenResponse.ok) {
    throw new BadRequestException('Invalid Auth0 code or authorization failed')
  }

  const { access_token } = (await tokenResponse.json()) as {
    access_token: string
  }

  // 2. Lấy profile từ Auth0
  interface Auth0Profile {
    email: string
    name: string
    picture: string
    sub: string
  }
  const profile = (await fetch(`https://${Env.AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${access_token}` }
  }).then((r) => r.json())) as Auth0Profile

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
  const { token: accessToken, expiresAt } = signJwtToken({ userId: user.id })
  const refreshToken = await createRefreshToken(user.id)

  return { accessToken, expiresAt, refreshToken, user }
}

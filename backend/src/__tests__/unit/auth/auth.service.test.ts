const redisExists = jest.fn()
const redisGet = jest.fn()
const redisSet = jest.fn()
const redisDel = jest.fn()
const redisGetBit = jest.fn()
const redisSetBit = jest.fn()
const redisIncr = jest.fn()
const redisExpire = jest.fn()
const redisPipelineSetex = jest.fn()
const redisPipelineDel = jest.fn()
const redisPipelineExec = jest.fn()
const userFindOne = jest.fn()
const userSave = jest.fn()
const userOmitPassword = jest.fn()
const userConstructor = jest.fn()
const refreshTokenDeleteMany = jest.fn()
const refreshTokenFindOneAndUpdate = jest.fn()
const reportSettingSave = jest.fn()
const reportSettingConstructor = jest.fn()
const reportSettingFindOne = jest.fn()
const sessionEnd = jest.fn()
const sessionWithTransaction = jest.fn()
const encryptPassword = jest.fn()
const decryptPassword = jest.fn()
const compareDummyPassword = jest.fn()
const sendVerificationEmail = jest.fn()
const sendPasswordResetEmail = jest.fn()
const sendPasswordChangedEmail = jest.fn()
const sendPasswordResetSuccessEmail = jest.fn()
const sendEmailChangedOldAddressEmail = jest.fn()
const sendEmailChangedNewAddressEmail = jest.fn()

const pipeline = {
  setex: redisPipelineSetex,
  del: redisPipelineDel,
  exec: redisPipelineExec
}

const mockAuthEmailKey = (email: string) =>
  `email-key:${email.trim().toLowerCase()}`

redisPipelineSetex.mockReturnValue(pipeline)
redisPipelineDel.mockReturnValue(pipeline)

jest.mock('../../../config/redis.config', () => ({
  LOGIN_ATTEMPT_CONFIG: { MAX_ATTEMPTS: 5 },
  OTP_CONFIG: { MAX_ATTEMPTS: 5 },
  REDIS_KEYS: {
    registerOtp: (email: string) => `otp:register:${mockAuthEmailKey(email)}`,
    registerPending: (email: string) =>
      `pending:register:${mockAuthEmailKey(email)}`,
    registerResend: (email: string) =>
      `resend:register:${mockAuthEmailKey(email)}`,
    registerAttempts: (email: string) =>
      `attempts:register:${mockAuthEmailKey(email)}`,
    forgotOtp: (email: string) => `otp:forgot:${mockAuthEmailKey(email)}`,
    forgotResend: (email: string) => `resend:forgot:${mockAuthEmailKey(email)}`,
    forgotAttempts: (email: string) =>
      `attempts:forgot:${mockAuthEmailKey(email)}`,
    resetToken: (email: string) =>
      `reset:forgot:token:${mockAuthEmailKey(email)}`,
    loginAttempts: (email: string) =>
      `attempts:login:${mockAuthEmailKey(email)}`
  },
  REDIS_TTL: {
    OTP: 300,
    PENDING: 900,
    RESEND: 60,
    OTP_ATTEMPTS: 900,
    FORGOT_OTP: 300,
    FORGOT_RESEND: 60,
    LOGIN_ATTEMPTS: 900
  },
  redis: {
    exists: redisExists,
    get: redisGet,
    set: redisSet,
    del: redisDel,
    getbit: redisGetBit,
    setbit: redisSetBit,
    incr: redisIncr,
    expire: redisExpire,
    pipeline: jest.fn(() => pipeline)
  }
}))

jest.mock('../../../models/user.model', () => ({
  __esModule: true,
  default: Object.assign(userConstructor, {
    findOne: userFindOne
  })
}))

jest.mock('../../../models/report-setting.model', () => ({
  __esModule: true,
  default: Object.assign(reportSettingConstructor, {
    findOne: reportSettingFindOne
  })
}))

jest.mock('../../../utils/dates/index', () => ({
  calculateNextReportDate: jest.fn(() => new Date('2026-07-01T00:00:00.000Z'))
}))

jest.mock('../../../services/session-revocation.service', () => ({
  revokeAllUserSessions: jest.fn()
}))

jest.mock('../../../models/refresh-token.model', () => ({
  __esModule: true,
  default: {
    deleteMany: refreshTokenDeleteMany,
    findOneAndUpdate: refreshTokenFindOneAndUpdate
  }
}))

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    startSession: jest.fn(async () => ({
      withTransaction: sessionWithTransaction,
      endSession: sessionEnd
    }))
  }
}))

jest.mock('../../../utils/encryption.util', () => ({
  encrypt: encryptPassword,
  decrypt: decryptPassword
}))

jest.mock('../../../utils/bcrypt.util', () => ({
  compareValue: compareDummyPassword,
  hashValue: jest.fn()
}))

jest.mock('../../../mailers/auth.mailer', () => ({
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendChangePasswordEmail: jest.fn(),
  sendChangeEmailOldOTP: jest.fn(),
  sendChangeEmailNewOTP: jest.fn(),
  sendPasswordChangedEmail,
  sendPasswordResetSuccessEmail,
  sendEmailChangedOldAddressEmail,
  sendEmailChangedNewAddressEmail
}))

jest.mock('../../../utils/generate-otp.util', () => ({
  generateSecureOTP: jest.fn(() => '123456')
}))

import {
  createRefreshToken,
  forgotPasswordService,
  loginService,
  logoutService,
  registerOTPService,
  resendRegisterVerifyOTPService,
  verifyRegisterOTPService
} from '../../../services/auth.service'
import jwt from 'jsonwebtoken'
import { Env } from '../../../config/env.config'
import {
  hashAccessTokenBlacklistKey,
  hashOtp,
  hashRefreshToken
} from '../../../utils/secure-hash.util'
import { signAccessToken } from '../../../utils/jwt.util'

describe('auth service hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redisPipelineSetex.mockReturnValue(pipeline)
    redisPipelineDel.mockReturnValue(pipeline)
    redisExists.mockResolvedValue(0)
    redisGet.mockResolvedValue(null)
    redisSet.mockResolvedValue('OK')
    redisDel.mockResolvedValue(1)
    redisGetBit.mockResolvedValue(0)
    redisSetBit.mockResolvedValue(0)
    redisIncr.mockResolvedValue(1)
    redisPipelineExec.mockResolvedValue([])
    userFindOne.mockResolvedValue(null)
    encryptPassword.mockResolvedValue('encrypted-password')
    decryptPassword.mockResolvedValue('Password1!')
    compareDummyPassword.mockResolvedValue(false)
    sendVerificationEmail.mockResolvedValue(undefined)
    sendPasswordResetEmail.mockResolvedValue(undefined)
    sendPasswordChangedEmail.mockResolvedValue(undefined)
    sendPasswordResetSuccessEmail.mockResolvedValue(undefined)
    sendEmailChangedOldAddressEmail.mockResolvedValue(undefined)
    sendEmailChangedNewAddressEmail.mockResolvedValue(undefined)
    userSave.mockResolvedValue(undefined)
    userOmitPassword.mockReturnValue({
      _id: 'user-id',
      name: 'Test User',
      email: 'user@example.com'
    })
    userConstructor.mockImplementation((data) => ({
      ...data,
      save: userSave,
      omitPassword: userOmitPassword
    }))
    refreshTokenDeleteMany.mockResolvedValue({ deletedCount: 0 })
    refreshTokenFindOneAndUpdate.mockResolvedValue({
      _id: 'refresh-token-id'
    })
    reportSettingSave.mockResolvedValue(undefined)
    reportSettingConstructor.mockImplementation((data) => ({
      ...data,
      save: reportSettingSave
    }))
    reportSettingFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    })
    sessionWithTransaction.mockImplementation(async (callback) => callback())
    sessionEnd.mockResolvedValue(undefined)
  })

  it('stores an encrypted password in pending registration data', async () => {
    await registerOTPService({
      name: 'Test User',
      email: 'user@example.com',
      password: 'Password1!'
    })

    expect(encryptPassword).toHaveBeenCalledWith('Password1!')

    const pendingCall = redisPipelineSetex.mock.calls.find(
      ([key]) => key === 'pending:register:email-key:user@example.com'
    )
    expect(pendingCall).toBeDefined()

    const pendingData = JSON.parse(pendingCall?.[2] as string)
    expect(pendingData).toEqual({
      name: 'Test User',
      email: 'user@example.com',
      encryptedPassword: 'encrypted-password'
    })
    expect(JSON.stringify(pendingData)).not.toContain('Password1!')
  })

  it('skips the MongoDB duplicate pre-check when register bitmap is ready and bit is zero', async () => {
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'bitmap:users:email:v1:ready') return '1'
      return null
    })
    redisGetBit.mockResolvedValueOnce(0)

    await registerOTPService({
      name: 'Test User',
      email: 'new@example.com',
      password: 'Password1!'
    })

    expect(redisGetBit).toHaveBeenCalledWith(
      'bitmap:users:email:v1',
      expect.any(Number)
    )
    expect(userFindOne).not.toHaveBeenCalled()
  })

  it('falls back to MongoDB pre-check when register bitmap is not ready', async () => {
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'bitmap:users:email:v1:ready') return null
      return null
    })

    await registerOTPService({
      name: 'Test User',
      email: 'new@example.com',
      password: 'Password1!'
    })

    expect(redisGetBit).not.toHaveBeenCalled()
    expect(userFindOne).toHaveBeenCalledWith({ email: 'new@example.com' })
  })

  it('does not reveal an existing email during registration OTP request', async () => {
    userFindOne.mockResolvedValueOnce({
      id: 'existing-user-id',
      email: 'user@example.com'
    })

    const result = await registerOTPService({
      name: 'Test User',
      email: 'user@example.com',
      password: 'Password1!'
    })

    expect(result).toEqual({
      message:
        'If this email can be registered, you will receive an OTP shortly'
    })
    expect(encryptPassword).not.toHaveBeenCalled()
    expect(redisPipelineSetex).not.toHaveBeenCalledWith(
      'pending:register:email-key:user@example.com',
      expect.any(Number),
      expect.any(String)
    )
    expect(sendVerificationEmail).not.toHaveBeenCalled()
  })

  it('does not reveal an existing email during register OTP resend', async () => {
    userFindOne.mockResolvedValueOnce({
      id: 'existing-user-id',
      email: 'user@example.com'
    })

    const result = await resendRegisterVerifyOTPService({
      email: 'user@example.com'
    })

    expect(result).toEqual({
      message:
        'If this email can be registered, you will receive an OTP shortly'
    })
    expect(redisPipelineSetex).not.toHaveBeenCalledWith(
      'otp:register:email-key:user@example.com',
      expect.any(Number),
      expect.any(String)
    )
    expect(sendVerificationEmail).not.toHaveBeenCalled()
  })

  it('skips MongoDB and mail for forgot password when bitmap is ready and bit is zero', async () => {
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'bitmap:users:email:v1:ready') return '1'
      return null
    })
    redisGetBit.mockResolvedValueOnce(0)

    await forgotPasswordService({ email: 'missing@example.com' })

    expect(userFindOne).not.toHaveBeenCalled()
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('decrypts the pending password before creating the verified user', async () => {
    const hashedOtp = hashOtp('123456')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:email-key:user@example.com') return hashedOtp
      if (key === 'pending:register:email-key:user@example.com') {
        return JSON.stringify({
          name: 'Test User',
          email: 'user@example.com',
          encryptedPassword: 'encrypted-password'
        })
      }
      return null
    })

    await verifyRegisterOTPService({
      email: 'user@example.com',
      otp: '123456'
    })

    expect(decryptPassword).toHaveBeenCalledWith('encrypted-password')
    expect(userConstructor).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'user@example.com',
      password: 'Password1!'
    })
  })

  it('rejects and cleans up a legacy plaintext pending registration', async () => {
    const hashedOtp = hashOtp('123456')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:email-key:user@example.com') return hashedOtp
      if (key === 'pending:register:email-key:user@example.com') {
        return JSON.stringify({
          name: 'Test User',
          email: 'user@example.com',
          password: 'Password1!'
        })
      }
      return null
    })

    await expect(
      verifyRegisterOTPService({
        email: 'user@example.com',
        otp: '123456'
      })
    ).rejects.toThrow('Registration session expired. Please register again')

    expect(userConstructor).not.toHaveBeenCalled()
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'otp:register:email-key:user@example.com'
    )
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'pending:register:email-key:user@example.com'
    )
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'resend:register:email-key:user@example.com'
    )
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'attempts:register:email-key:user@example.com'
    )
  })

  it('returns the same unauthorized outcome for a missing user and wrong password', async () => {
    const missingUserSelect = jest.fn().mockResolvedValue(null)
    userFindOne.mockReturnValueOnce({ select: missingUserSelect })

    const missingUserError = await loginService(
      {
        email: 'missing@example.com',
        password: 'submitted-password'
      },
      'test-agent'
    ).catch((error) => error)

    const wrongPasswordUser = {
      comparePassword: jest.fn().mockResolvedValue(false)
    }
    const wrongPasswordSelect = jest.fn().mockResolvedValue(wrongPasswordUser)
    userFindOne.mockReturnValueOnce({ select: wrongPasswordSelect })

    const wrongPasswordError = await loginService(
      {
        email: 'user@example.com',
        password: 'submitted-password'
      },
      'test-agent'
    ).catch((error) => error)

    expect(compareDummyPassword).toHaveBeenCalledWith(
      'submitted-password',
      expect.any(String)
    )
    expect({
      statusCode: missingUserError.statusCode,
      message: missingUserError.message,
      errorCode: missingUserError.errorCode
    }).toEqual({
      statusCode: wrongPasswordError.statusCode,
      message: wrongPasswordError.message,
      errorCode: wrongPasswordError.errorCode
    })
    expect(missingUserError.statusCode).toBe(401)
    expect(missingUserError.message).toBe('Invalid email or password')
    expect(redisIncr).toHaveBeenCalledWith(
      'attempts:login:email-key:missing@example.com'
    )
    expect(redisIncr).toHaveBeenCalledWith(
      'attempts:login:email-key:user@example.com'
    )
    expect(redisExpire).toHaveBeenCalledWith(
      'attempts:login:email-key:missing@example.com',
      900
    )
    expect(redisExpire).toHaveBeenCalledWith(
      'attempts:login:email-key:user@example.com',
      900
    )
  })

  it('rejects login when the canonical email is locked', async () => {
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'attempts:login:email-key:user@example.com') return '5'
      return null
    })

    await expect(
      loginService(
        {
          email: ' User@Example.com ',
          password: 'submitted-password'
        },
        'test-agent'
      )
    ).rejects.toThrow('Invalid email or password')

    expect(userFindOne).not.toHaveBeenCalled()
    expect(redisIncr).not.toHaveBeenCalled()
  })

  it('clears failed login attempts after a successful login', async () => {
    const loginUser = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      timezone: 'UTC',
      tokenVersion: 0,
      comparePassword: jest.fn().mockResolvedValue(true),
      save: userSave,
      omitPassword: userOmitPassword
    }
    const userSelect = jest.fn().mockResolvedValue(loginUser)
    userFindOne.mockReturnValueOnce({ select: userSelect })

    const result = await loginService(
      {
        email: 'user@example.com',
        password: 'submitted-password'
      },
      'test-agent'
    )

    expect(result.accessToken).toEqual(expect.any(String))
    expect(redisDel).toHaveBeenCalledWith(
      'attempts:login:email-key:user@example.com'
    )
    expect(redisIncr).not.toHaveBeenCalled()
  })

  it('stores a refresh token digest when creating a refresh token', async () => {
    const refreshToken = await createRefreshToken('user-id', 'test-agent')

    expect(refreshToken).toEqual(expect.any(String))
    expect(refreshTokenFindOneAndUpdate).toHaveBeenCalledWith(
      { token: hashRefreshToken(refreshToken) },
      expect.objectContaining({
        userId: 'user-id',
        token: hashRefreshToken(refreshToken),
        userAgent: 'test-agent',
        isRevoked: false
      }),
      { upsert: true, new: true }
    )
    expect(refreshTokenFindOneAndUpdate).not.toHaveBeenCalledWith(
      { token: refreshToken },
      expect.anything(),
      expect.anything()
    )
  })

  it('revokes refresh token and blacklists access token by digest on logout', async () => {
    const { token: accessToken } = signAccessToken({
      userId: 'user-id',
      tokenVersion: 0
    })
    const refreshToken = 'raw-refresh-token'

    await logoutService(refreshToken, accessToken)

    expect(refreshTokenFindOneAndUpdate).toHaveBeenCalledWith(
      { token: hashRefreshToken(refreshToken), isRevoked: false },
      { isRevoked: true, revocationReason: 'logout' }
    )
    expect(redisSet).toHaveBeenCalledWith(
      `blacklist:${hashAccessTokenBlacklistKey(accessToken)}`,
      'revoked',
      'EX',
      expect.any(Number)
    )
    expect(redisSet).not.toHaveBeenCalledWith(
      `blacklist:${accessToken}`,
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
  })

  it('does not blacklist a forged access token during logout cleanup', async () => {
    const forgedAccessToken = jwt.sign(
      {
        userId: 'user-id',
        tokenVersion: 0
      },
      'wrong-secret',
      {
        algorithm: 'HS256',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m'
      }
    )
    const refreshToken = 'raw-refresh-token'

    await expect(
      logoutService(refreshToken, forgedAccessToken)
    ).resolves.toEqual({
      message: 'Logged out successfully'
    })

    expect(refreshTokenFindOneAndUpdate).toHaveBeenCalledWith(
      { token: hashRefreshToken(refreshToken), isRevoked: false },
      { isRevoked: true, revocationReason: 'logout' }
    )
    expect(redisSet).not.toHaveBeenCalled()
  })

  it('translates a duplicate email race into the existing conflict response', async () => {
    const hashedOtp = hashOtp('123456')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:email-key:user@example.com') return hashedOtp
      if (key === 'pending:register:email-key:user@example.com') {
        return JSON.stringify({
          name: 'Test User',
          email: 'user@example.com',
          encryptedPassword: 'encrypted-password'
        })
      }
      return null
    })
    userSave.mockRejectedValueOnce(
      Object.assign(new Error('E11000 duplicate key error'), {
        code: 11000,
        keyPattern: { email: 1 }
      })
    )

    const error = await verifyRegisterOTPService({
      email: 'user@example.com',
      otp: '123456'
    }).catch((caught) => caught)

    expect(error.statusCode).toBe(409)
    expect(error.errorCode).toBe('AUTH_EMAIL_ALREADY_EXISTS')
    expect(error.message).toBe('Email already exists')
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'pending:register:email-key:user@example.com'
    )
  })

  it('fails closed and cleans up when pending ciphertext cannot be decrypted', async () => {
    const hashedOtp = hashOtp('123456')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:email-key:user@example.com') return hashedOtp
      if (key === 'pending:register:email-key:user@example.com') {
        return JSON.stringify({
          name: 'Test User',
          email: 'user@example.com',
          encryptedPassword: 'corrupted-ciphertext'
        })
      }
      return null
    })
    decryptPassword.mockRejectedValueOnce(
      new Error('Unsupported state or unable to authenticate data')
    )

    await expect(
      verifyRegisterOTPService({
        email: 'user@example.com',
        otp: '123456'
      })
    ).rejects.toThrow('Registration session expired. Please register again')

    expect(userConstructor).not.toHaveBeenCalled()
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'pending:register:email-key:user@example.com'
    )
  })

  it('does not hide non-duplicate database failures', async () => {
    const hashedOtp = hashOtp('123456')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:email-key:user@example.com') return hashedOtp
      if (key === 'pending:register:email-key:user@example.com') {
        return JSON.stringify({
          name: 'Test User',
          email: 'user@example.com',
          encryptedPassword: 'encrypted-password'
        })
      }
      return null
    })
    const databaseError = new Error('database unavailable')
    userSave.mockRejectedValueOnce(databaseError)

    await expect(
      verifyRegisterOTPService({
        email: 'user@example.com',
        otp: '123456'
      })
    ).rejects.toBe(databaseError)
  })
})

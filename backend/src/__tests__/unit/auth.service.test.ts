import crypto from 'crypto'

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
const reportSettingSave = jest.fn()
const reportSettingConstructor = jest.fn()
const sessionEnd = jest.fn()
const sessionWithTransaction = jest.fn()
const encryptPassword = jest.fn()
const decryptPassword = jest.fn()
const compareDummyPassword = jest.fn()
const sendVerificationEmail = jest.fn()
const sendPasswordResetEmail = jest.fn()

const pipeline = {
  setex: redisPipelineSetex,
  del: redisPipelineDel,
  exec: redisPipelineExec
}

redisPipelineSetex.mockReturnValue(pipeline)
redisPipelineDel.mockReturnValue(pipeline)

jest.mock('../../config/redis.config', () => ({
  OTP_CONFIG: { MAX_ATTEMPTS: 5 },
  REDIS_KEYS: {
    registerOtp: (email: string) => `otp:register:${email}`,
    registerPending: (email: string) => `pending:register:${email}`,
    registerResend: (email: string) => `resend:register:${email}`,
    registerAttempts: (email: string) => `attempts:register:${email}`,
    forgotOtp: (email: string) => `otp:forgot:${email}`,
    forgotResend: (email: string) => `resend:forgot:${email}`,
    forgotAttempts: (email: string) => `attempts:forgot:${email}`
  },
  REDIS_TTL: {
    OTP: 300,
    PENDING: 900,
    RESEND: 60,
    OTP_ATTEMPTS: 900,
    FORGOT_OTP: 300,
    FORGOT_RESEND: 60
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

jest.mock('../../models/user.model', () => ({
  __esModule: true,
  default: Object.assign(userConstructor, {
    findOne: userFindOne
  })
}))

jest.mock('../../models/report-setting.model', () => ({
  __esModule: true,
  default: reportSettingConstructor
}))

jest.mock('../../utils/dates/index', () => ({
  calculateNextReportDate: jest.fn(() => new Date('2026-07-01T00:00:00.000Z'))
}))

jest.mock('../../services/session-revocation.service', () => ({
  revokeAllUserSessions: jest.fn()
}))

jest.mock('../../models/refresh-token.model', () => ({
  __esModule: true,
  default: {}
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

jest.mock('../../utils/encryption.util', () => ({
  encrypt: encryptPassword,
  decrypt: decryptPassword
}))

jest.mock('../../utils/bcrypt.util', () => ({
  compareValue: compareDummyPassword,
  hashValue: jest.fn()
}))

jest.mock('../../mailers/auth.mailer', () => ({
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendChangePasswordEmail: jest.fn(),
  sendChangeEmailOldOTP: jest.fn(),
  sendChangeEmailNewOTP: jest.fn()
}))

jest.mock('../../utils/generate-otp.util', () => ({
  generateSecureOTP: jest.fn(() => '123456')
}))

import {
  forgotPasswordService,
  loginService,
  registerOTPService,
  resendRegisterVerifyOTPService,
  verifyRegisterOTPService
} from '../../services/auth.service'

describe('auth service hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redisPipelineSetex.mockReturnValue(pipeline)
    redisPipelineDel.mockReturnValue(pipeline)
    redisExists.mockResolvedValue(0)
    redisSet.mockResolvedValue('OK')
    redisDel.mockResolvedValue(1)
    redisGetBit.mockResolvedValue(0)
    redisSetBit.mockResolvedValue(0)
    redisPipelineExec.mockResolvedValue([])
    userFindOne.mockResolvedValue(null)
    encryptPassword.mockResolvedValue('encrypted-password')
    decryptPassword.mockResolvedValue('Password1!')
    compareDummyPassword.mockResolvedValue(false)
    sendVerificationEmail.mockResolvedValue(undefined)
    sendPasswordResetEmail.mockResolvedValue(undefined)
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
    reportSettingSave.mockResolvedValue(undefined)
    reportSettingConstructor.mockImplementation((data) => ({
      ...data,
      save: reportSettingSave
    }))
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
      ([key]) => key === 'pending:register:user@example.com'
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
      'pending:register:user@example.com',
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
      'otp:register:user@example.com',
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
    const hashedOtp = crypto.createHash('sha256').update('123456').digest('hex')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:user@example.com') return hashedOtp
      if (key === 'pending:register:user@example.com') {
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
    const hashedOtp = crypto.createHash('sha256').update('123456').digest('hex')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:user@example.com') return hashedOtp
      if (key === 'pending:register:user@example.com') {
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
    ).rejects.toThrow('Registration session expired. Please register again.')

    expect(userConstructor).not.toHaveBeenCalled()
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'otp:register:user@example.com'
    )
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'pending:register:user@example.com'
    )
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'resend:register:user@example.com'
    )
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'attempts:register:user@example.com'
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
  })

  it('translates a duplicate email race into the existing conflict response', async () => {
    const hashedOtp = crypto.createHash('sha256').update('123456').digest('hex')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:user@example.com') return hashedOtp
      if (key === 'pending:register:user@example.com') {
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
      'pending:register:user@example.com'
    )
  })

  it('fails closed and cleans up when pending ciphertext cannot be decrypted', async () => {
    const hashedOtp = crypto.createHash('sha256').update('123456').digest('hex')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:user@example.com') return hashedOtp
      if (key === 'pending:register:user@example.com') {
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
    ).rejects.toThrow('Registration session expired. Please register again.')

    expect(userConstructor).not.toHaveBeenCalled()
    expect(redisPipelineDel).toHaveBeenCalledWith(
      'pending:register:user@example.com'
    )
  })

  it('does not hide non-duplicate database failures', async () => {
    const hashedOtp = crypto.createHash('sha256').update('123456').digest('hex')
    redisGet.mockImplementation(async (key: string) => {
      if (key === 'otp:register:user@example.com') return hashedOtp
      if (key === 'pending:register:user@example.com') {
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

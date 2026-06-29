import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

const hashedOtp = 'hmac:123456'
const mockAuthEmailKey = (email: string) =>
  `email-key:${email.trim().toLowerCase()}`
const redisPipeline = {
  del: jest.fn(),
  exec: jest.fn()
}

redisPipeline.del.mockReturnValue(redisPipeline)
redisPipeline.exec.mockResolvedValue([])

jest.mock('../../../config/redis.config', () => ({
  OTP_CONFIG: { MAX_ATTEMPTS: 5 },
  REDIS_KEYS: {
    registerOtp: (email: string) => `otp:register:${mockAuthEmailKey(email)}`,
    registerPending: (email: string) =>
      `pending:register:${mockAuthEmailKey(email)}`,
    registerResend: (email: string) =>
      `resend:register:${mockAuthEmailKey(email)}`,
    registerAttempts: (email: string) =>
      `attempts:register:${mockAuthEmailKey(email)}`
  },
  REDIS_TTL: {
    OTP: 300,
    PENDING: 900,
    RESEND: 60,
    OTP_ATTEMPTS: 900
  },
  redis: {
    get: jest.fn(async (key: string) => {
      if (key.startsWith('otp:register:')) return hashedOtp
      if (key.startsWith('pending:register:')) {
        return JSON.stringify({
          name: 'Race User',
          email: 'race@example.com',
          encryptedPassword: 'encrypted-password'
        })
      }
      return null
    }),
    pipeline: jest.fn(() => redisPipeline)
  }
}))

jest.mock('../../../utils/secure-hash.util', () => ({
  hashOtp: jest.fn((value: string) => `hmac:${value}`),
  hashResetToken: jest.fn((value: string) => `hmac-reset:${value}`),
  hashRefreshToken: jest.fn((value: string) => `hmac-refresh:${value}`),
  hashAccessTokenBlacklistKey: jest.fn(
    (value: string) => `hmac-blacklist:${value}`
  ),
  hashAuthEmailKey: jest.fn((email: string) => mockAuthEmailKey(email))
}))

jest.mock('../../../utils/encryption.util', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(async () => 'Password1!')
}))

jest.mock('../../../mailers/auth.mailer', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendChangePasswordEmail: jest.fn(),
  sendChangeEmailOldOTP: jest.fn(),
  sendChangeEmailNewOTP: jest.fn()
}))

import UserModel from '../../../models/user.model'
import ReportSettingModel from '../../../models/report-setting.model'
import { verifyRegisterOTPService } from '../../../services/auth.service'

describe('registration verification race', () => {
  let mongoServer: MongoMemoryReplSet

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    })
    await mongoose.connect(mongoServer.getUri())
    await UserModel.init()
  })

  afterEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      ReportSettingModel.deleteMany({})
    ])
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  it('returns conflict when the email was created by another verification', async () => {
    await expect(
      verifyRegisterOTPService({
        email: 'race@example.com',
        otp: '123456'
      })
    ).resolves.toEqual(
      expect.objectContaining({ message: 'Account verified successfully' })
    )

    const error = await verifyRegisterOTPService({
      email: 'race@example.com',
      otp: '123456'
    }).catch((caught) => caught)

    expect(error.statusCode).toBe(409)
    expect(error.errorCode).toBe('AUTH_EMAIL_ALREADY_EXISTS')
    await expect(
      UserModel.countDocuments({ email: 'race@example.com' })
    ).resolves.toBe(1)
  })
})

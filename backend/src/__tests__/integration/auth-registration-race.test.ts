import crypto from 'crypto'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

const hashedOtp = crypto.createHash('sha256').update('123456').digest('hex')
const redisPipeline = {
  del: jest.fn(),
  exec: jest.fn()
}

redisPipeline.del.mockReturnValue(redisPipeline)
redisPipeline.exec.mockResolvedValue([])

jest.mock('../../config/redis.config', () => ({
  OTP_CONFIG: { MAX_ATTEMPTS: 5 },
  REDIS_KEYS: {
    registerOtp: (email: string) => `otp:register:${email}`,
    registerPending: (email: string) => `pending:register:${email}`,
    registerResend: (email: string) => `resend:register:${email}`,
    registerAttempts: (email: string) => `attempts:register:${email}`
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

jest.mock('../../utils/encryption.util', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(async () => 'Password1!')
}))

jest.mock('../../mailers/auth.mailer', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendChangePasswordEmail: jest.fn(),
  sendChangeEmailOldOTP: jest.fn(),
  sendChangeEmailNewOTP: jest.fn()
}))

import UserModel from '../../models/user.model'
import ReportSettingModel from '../../models/report-setting.model'
import { verifyRegisterOTPService } from '../../services/auth.service'

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

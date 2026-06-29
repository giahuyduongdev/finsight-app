import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import express from 'express'
import RefreshTokenModel from '../../../models/refresh-token.model'
import UserModel from '../../../models/user.model'
import {
  createRefreshToken,
  logoutService,
  refreshTokenService
} from '../../../services/auth.service'
import {
  hashAccessTokenBlacklistKey,
  hashRefreshToken
} from '../../../utils/secure-hash.util'
import { redis } from '../../../config/redis.config'
import { checkBlacklist } from '../../../middlewares/blacklist.middleware'
import { errorHandler } from '../../../middlewares/errorHandler.middleware'

describe('auth token digest persistence', () => {
  let mongoServer: MongoMemoryReplSet
  const redisSet = redis.set as jest.Mock

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    })
    await mongoose.connect(mongoServer.getUri())
  })

  afterEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      RefreshTokenModel.deleteMany({})
    ])
    redisSet.mockClear()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  it('refreshes and logs out using refresh-token digest persistence', async () => {
    const user = await UserModel.create({
      name: 'Digest User',
      email: 'digest@example.com',
      password: 'Password1!'
    })

    const refreshToken = await createRefreshToken(user.id, 'integration-agent')
    const refreshTokenHash = hashRefreshToken(refreshToken)
    const persistedToken = await RefreshTokenModel.findOne({ userId: user._id })

    expect(persistedToken?.token).toBe(refreshTokenHash)
    expect(persistedToken?.token).not.toBe(refreshToken)

    const refreshed = await refreshTokenService(refreshToken)
    expect(refreshed.accessToken).toEqual(expect.any(String))

    await logoutService(refreshToken, refreshed.accessToken)

    await expect(
      RefreshTokenModel.findOne({ token: refreshTokenHash })
    ).resolves.toEqual(expect.objectContaining({ isRevoked: true }))
    expect(redisSet).toHaveBeenCalledWith(
      `blacklist:${hashAccessTokenBlacklistKey(refreshed.accessToken)}`,
      'revoked',
      'EX',
      expect.any(Number)
    )
    expect(redisSet).not.toHaveBeenCalledWith(
      `blacklist:${refreshed.accessToken}`,
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
  })

  it('rejects blacklisted access tokens through the global middleware', async () => {
    const accessToken = 'blacklisted-access-token'
    const app = express()
    app.use(checkBlacklist)
    app.get('/health', (_req, res) => res.json({ status: 'ok' }))
    app.use(errorHandler)

    redisSet.mockResolvedValueOnce('OK')
    ;(redis.get as jest.Mock).mockImplementationOnce(async (key: string) =>
      key === `blacklist:${hashAccessTokenBlacklistKey(accessToken)}`
        ? 'revoked'
        : null
    )

    const response = await request(app)
      .get('/health')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(response.status).toBe(401)
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Token has been revoked'
        })
      })
    )
    expect(redis.get).toHaveBeenCalledWith(
      `blacklist:${hashAccessTokenBlacklistKey(accessToken)}`
    )
    expect(redis.get).not.toHaveBeenCalledWith(`blacklist:${accessToken}`)
  })
})

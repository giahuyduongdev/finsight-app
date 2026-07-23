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
import { signAccessToken, signRefreshToken } from '../../../utils/jwt.util'

jest.setTimeout(30000)

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

    expect(refreshed.refreshToken).toEqual(expect.any(String))
    const rotatedRefreshToken = refreshed.refreshToken
    if (!rotatedRefreshToken) throw new Error('Expected rotated refresh token')

    await logoutService(rotatedRefreshToken, refreshed.accessToken)

    await expect(
      RefreshTokenModel.findOne({
        token: hashRefreshToken(rotatedRefreshToken)
      })
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

  it('rotates refresh tokens and revokes the presented token', async () => {
    const user = await UserModel.create({
      name: 'Rotation User',
      email: 'rotation@example.com',
      password: 'Password1!'
    })

    const refreshToken = await createRefreshToken(user.id, 'integration-agent')
    const originalHash = hashRefreshToken(refreshToken)

    const refreshed = await refreshTokenService(refreshToken)

    expect(refreshed.accessToken).toEqual(expect.any(String))
    expect(refreshed.refreshToken).toEqual(expect.any(String))
    const rotatedRefreshToken = refreshed.refreshToken
    if (!rotatedRefreshToken) throw new Error('Expected rotated refresh token')
    expect(rotatedRefreshToken).not.toBe(refreshToken)

    await expect(
      RefreshTokenModel.findOne({ token: originalHash })
    ).resolves.toEqual(
      expect.objectContaining({
        isRevoked: true,
        revocationReason: 'rotated',
        replacedByToken: hashRefreshToken(rotatedRefreshToken)
      })
    )
    await expect(
      RefreshTokenModel.findOne({
        token: hashRefreshToken(rotatedRefreshToken)
      })
    ).resolves.toEqual(
      expect.objectContaining({
        isRevoked: false,
        tokenFamilyId: expect.any(String),
        rotatedFromToken: originalHash
      })
    )
  })

  it('allows the immediately previous refresh token during grace without another rotation', async () => {
    const user = await UserModel.create({
      name: 'Grace User',
      email: 'grace@example.com',
      password: 'Password1!'
    })

    const refreshToken = await createRefreshToken(user.id, 'integration-agent')
    const firstRefresh = await refreshTokenService(refreshToken)
    const rotatedRefreshToken = firstRefresh.refreshToken
    if (!rotatedRefreshToken) throw new Error('Expected rotated refresh token')
    const graceRefresh = await refreshTokenService(refreshToken)

    expect(graceRefresh.accessToken).toEqual(expect.any(String))
    expect(graceRefresh.refreshToken).toBeUndefined()
    await expect(
      RefreshTokenModel.countDocuments({
        userId: user._id,
        isRevoked: false
      })
    ).resolves.toBe(1)
    await expect(
      RefreshTokenModel.findOne({
        token: hashRefreshToken(rotatedRefreshToken)
      })
    ).resolves.toEqual(expect.objectContaining({ isRevoked: false }))
  })

  it('revokes the active token family when a rotated token is replayed outside grace', async () => {
    const user = await UserModel.create({
      name: 'Replay User',
      email: 'replay@example.com',
      password: 'Password1!'
    })

    const refreshToken = await createRefreshToken(user.id, 'integration-agent')
    const firstRefresh = await refreshTokenService(refreshToken)
    const rotatedRefreshToken = firstRefresh.refreshToken
    if (!rotatedRefreshToken) throw new Error('Expected rotated refresh token')
    const originalHash = hashRefreshToken(refreshToken)

    await RefreshTokenModel.updateOne(
      { token: originalHash },
      { reuseGraceUntil: new Date(Date.now() - 1000) }
    )

    await expect(refreshTokenService(refreshToken)).rejects.toThrow(
      'Refresh token is invalid or expired'
    )
    await expect(
      RefreshTokenModel.findOne({
        token: hashRefreshToken(rotatedRefreshToken)
      })
    ).resolves.toEqual(
      expect.objectContaining({
        isRevoked: true,
        revocationReason: 'replay'
      })
    )
  })

  it('revokes the token family when an older rotated token is replayed', async () => {
    const user = await UserModel.create({
      name: 'Older Replay User',
      email: 'older-replay@example.com',
      password: 'Password1!'
    })

    const firstToken = await createRefreshToken(user.id, 'integration-agent')
    const secondResult = await refreshTokenService(firstToken)
    const secondToken = secondResult.refreshToken
    if (!secondToken) throw new Error('Expected second refresh token')

    const thirdResult = await refreshTokenService(secondToken)
    const thirdToken = thirdResult.refreshToken
    if (!thirdToken) throw new Error('Expected third refresh token')

    await expect(refreshTokenService(firstToken)).rejects.toThrow(
      'Refresh token is invalid or expired'
    )
    await expect(
      RefreshTokenModel.findOne({ token: hashRefreshToken(thirdToken) })
    ).resolves.toEqual(
      expect.objectContaining({
        isRevoked: true,
        revocationReason: 'replay'
      })
    )
  })

  it('does not revoke unrelated sessions for an unknown refresh token', async () => {
    const user = await UserModel.create({
      name: 'Unknown Token User',
      email: 'unknown-token@example.com',
      password: 'Password1!'
    })
    const activeToken = await createRefreshToken(user.id, 'integration-agent')
    const { token: unknownToken } = signRefreshToken({ userId: user.id })

    await expect(refreshTokenService(unknownToken)).rejects.toThrow(
      'Refresh token is invalid or expired'
    )
    await expect(
      RefreshTokenModel.findOne({ token: hashRefreshToken(activeToken) })
    ).resolves.toEqual(expect.objectContaining({ isRevoked: false }))
  })

  it('does not treat logout-revoked refresh tokens as grace eligible', async () => {
    const user = await UserModel.create({
      name: 'Logout Revoked User',
      email: 'logout-revoked@example.com',
      password: 'Password1!',
      tokenVersion: 0
    })
    const refreshToken = await createRefreshToken(user.id, 'integration-agent')
    const { token: accessToken } = signAccessToken({
      userId: user.id,
      tokenVersion: 0
    })

    await logoutService(refreshToken, accessToken)

    await expect(refreshTokenService(refreshToken)).rejects.toThrow(
      'Refresh token is invalid or expired'
    )
    const persistedToken = await RefreshTokenModel.findOne({
      token: hashRefreshToken(refreshToken)
    }).lean()
    expect(persistedToken).toMatchObject({
      isRevoked: true,
      revocationReason: 'logout'
    })
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

  it('rejects refresh requests carrying a blacklisted access token before the route handler', async () => {
    const accessToken = 'blacklisted-refresh-route-access-token'
    const refreshHandler = jest.fn((_req, res) =>
      res.json({ accessToken: 'new-access-token' })
    )
    const app = express()
    app.use(checkBlacklist)
    app.post('/api/v1/auth/refresh-token', refreshHandler)
    app.use(errorHandler)

    ;(redis.get as jest.Mock).mockImplementationOnce(async (key: string) =>
      key === `blacklist:${hashAccessTokenBlacklistKey(accessToken)}`
        ? 'revoked'
        : null
    )

    const response = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', 'refreshToken=valid-refresh-cookie')

    expect(response.status).toBe(401)
    expect(refreshHandler).not.toHaveBeenCalled()
    expect(redis.get).toHaveBeenCalledWith(
      `blacklist:${hashAccessTokenBlacklistKey(accessToken)}`
    )
  })
})

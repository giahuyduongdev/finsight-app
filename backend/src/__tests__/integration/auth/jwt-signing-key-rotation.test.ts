import express from 'express'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import passport from 'passport'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import RefreshTokenModel from '../../../models/refresh-token.model'
import UserModel from '../../../models/user.model'
import { Env } from '../../../config/env.config'
import { passportAuthenticateJwt } from '../../../config/passport.config'
import {
  createRefreshToken,
  refreshTokenService
} from '../../../services/auth.service'
import { hashRefreshToken } from '../../../utils/secure-hash.util'

jest.setTimeout(30000)

describe('jwt signing key rotation', () => {
  let mongoServer: MongoMemoryReplSet
  const originalJwtConfig = {
    accessCurrentKid: Env.JWT_ACCESS_CURRENT_KID,
    accessCurrentSecret: Env.JWT_ACCESS_CURRENT_SECRET,
    accessPreviousKid: Env.JWT_ACCESS_PREVIOUS_KID,
    accessPreviousSecret: Env.JWT_ACCESS_PREVIOUS_SECRET,
    accessLegacyFallbackEnabled: Env.JWT_ACCESS_LEGACY_FALLBACK_ENABLED,
    refreshCurrentKid: Env.JWT_REFRESH_CURRENT_KID,
    refreshCurrentSecret: Env.JWT_REFRESH_CURRENT_SECRET,
    refreshPreviousKid: Env.JWT_REFRESH_PREVIOUS_KID,
    refreshPreviousSecret: Env.JWT_REFRESH_PREVIOUS_SECRET,
    refreshLegacyFallbackEnabled: Env.JWT_REFRESH_LEGACY_FALLBACK_ENABLED
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    })
    await mongoose.connect(mongoServer.getUri())
  })

  beforeEach(() => {
    Env.JWT_ACCESS_CURRENT_KID = 'access-current'
    Env.JWT_ACCESS_CURRENT_SECRET = 'access-current-secret'
    Env.JWT_ACCESS_PREVIOUS_KID = 'access-previous'
    Env.JWT_ACCESS_PREVIOUS_SECRET = 'access-previous-secret'
    Env.JWT_ACCESS_LEGACY_FALLBACK_ENABLED = 'false'
    Env.JWT_REFRESH_CURRENT_KID = 'refresh-current'
    Env.JWT_REFRESH_CURRENT_SECRET = 'refresh-current-secret'
    Env.JWT_REFRESH_PREVIOUS_KID = 'refresh-previous'
    Env.JWT_REFRESH_PREVIOUS_SECRET = 'refresh-previous-secret'
    Env.JWT_REFRESH_LEGACY_FALLBACK_ENABLED = 'false'
  })

  afterEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      RefreshTokenModel.deleteMany({})
    ])
  })

  afterAll(async () => {
    Env.JWT_ACCESS_CURRENT_KID = originalJwtConfig.accessCurrentKid
    Env.JWT_ACCESS_CURRENT_SECRET = originalJwtConfig.accessCurrentSecret
    Env.JWT_ACCESS_PREVIOUS_KID = originalJwtConfig.accessPreviousKid
    Env.JWT_ACCESS_PREVIOUS_SECRET = originalJwtConfig.accessPreviousSecret
    Env.JWT_ACCESS_LEGACY_FALLBACK_ENABLED =
      originalJwtConfig.accessLegacyFallbackEnabled
    Env.JWT_REFRESH_CURRENT_KID = originalJwtConfig.refreshCurrentKid
    Env.JWT_REFRESH_CURRENT_SECRET = originalJwtConfig.refreshCurrentSecret
    Env.JWT_REFRESH_PREVIOUS_KID = originalJwtConfig.refreshPreviousKid
    Env.JWT_REFRESH_PREVIOUS_SECRET = originalJwtConfig.refreshPreviousSecret
    Env.JWT_REFRESH_LEGACY_FALLBACK_ENABLED =
      originalJwtConfig.refreshLegacyFallbackEnabled
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  it('accepts protected HTTP requests signed by the previous access key', async () => {
    const user = await UserModel.create({
      name: 'Key Rotation User',
      email: 'key-rotation@example.com',
      password: 'Password1!',
      tokenVersion: 0
    })
    const accessToken = jwt.sign(
      {
        userId: user.id,
        tokenVersion: 0
      },
      Env.JWT_ACCESS_PREVIOUS_SECRET,
      {
        algorithm: 'HS256',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m',
        keyid: Env.JWT_ACCESS_PREVIOUS_KID
      }
    )
    const app = express()
    app.use(passport.initialize())
    app.get('/protected', passportAuthenticateJwt, (req, res) => {
      res.json({ userId: req.user?._id?.toString() })
    })

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ userId: user.id })
  })

  it('rejects unknown access key ids as unauthorized instead of server errors', async () => {
    const accessToken = jwt.sign(
      {
        userId: new mongoose.Types.ObjectId().toString(),
        tokenVersion: 0
      },
      'unknown-secret',
      {
        algorithm: 'HS256',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m',
        keyid: 'unknown-access'
      }
    )
    const app = express()
    app.use(passport.initialize())
    app.get('/protected', passportAuthenticateJwt, (_req, res) => {
      res.json({ ok: true })
    })

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(response.status).toBe(401)
  })

  it('creates refresh tokens with the current refresh key id', async () => {
    const user = await UserModel.create({
      name: 'Current Refresh User',
      email: 'current-refresh@example.com',
      password: 'Password1!'
    })

    const refreshToken = await createRefreshToken(user.id, 'integration-agent')

    expect(jwt.decode(refreshToken, { complete: true })).toEqual(
      expect.objectContaining({
        header: expect.objectContaining({
          kid: Env.JWT_REFRESH_CURRENT_KID,
          alg: 'HS256'
        })
      })
    )
  })

  it('refreshes using a token signed by the previous refresh key', async () => {
    const user = await UserModel.create({
      name: 'Previous Refresh User',
      email: 'previous-refresh@example.com',
      password: 'Password1!',
      tokenVersion: 0
    })
    const refreshToken = jwt.sign(
      {
        userId: user.id
      },
      Env.JWT_REFRESH_PREVIOUS_SECRET,
      {
        algorithm: 'HS256',
        audience: 'refresh',
        issuer: Env.JWT_ISSUER,
        expiresIn: '7d',
        keyid: Env.JWT_REFRESH_PREVIOUS_KID
      }
    )
    await RefreshTokenModel.create({
      userId: user._id,
      token: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      userAgent: 'integration-agent',
      isRevoked: false
    })

    const refreshed = await refreshTokenService(refreshToken)

    expect(jwt.decode(refreshed.accessToken, { complete: true })).toEqual(
      expect.objectContaining({
        header: expect.objectContaining({
          kid: Env.JWT_ACCESS_CURRENT_KID,
          alg: 'HS256'
        })
      })
    )
  })
})

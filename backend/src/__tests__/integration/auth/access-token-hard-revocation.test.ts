import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import RefreshTokenModel from '../../../models/refresh-token.model'
import UserModel from '../../../models/user.model'
import { authenticateAccessToken } from '../../../services/access-token-auth.service'
import { revokeAllUserSessions } from '../../../services/session-revocation.service'
import { signAccessToken, verifyAccessToken } from '../../../utils/jwt.util'

jest.setTimeout(30000)

describe('access token hard revocation', () => {
  let mongoServer: MongoMemoryReplSet

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    })
    await mongoose.connect(mongoServer.getUri())
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  afterEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      RefreshTokenModel.deleteMany({})
    ])
  })

  it('rejects all old access tokens and accepts a newly issued token', async () => {
    const user = await UserModel.create({
      name: 'Hard Revocation User',
      email: 'hard-revocation@example.com',
      password: 'Password1!'
    })
    await RefreshTokenModel.create({
      userId: user._id,
      token: 'refresh-token',
      expiresAt: new Date(Date.now() + 60_000)
    })

    const tokenA = signAccessToken({
      userId: user.id,
      tokenVersion: 0
    }).token
    const tokenB = signAccessToken({
      userId: user.id,
      tokenVersion: 0
    }).token

    await expect(
      authenticateAccessToken(verifyAccessToken(tokenA))
    ).resolves.toBeTruthy()
    await expect(
      authenticateAccessToken(verifyAccessToken(tokenB))
    ).resolves.toBeTruthy()

    await expect(revokeAllUserSessions(user.id)).resolves.toBe(1)

    await expect(
      authenticateAccessToken(verifyAccessToken(tokenA))
    ).resolves.toBeNull()
    await expect(
      authenticateAccessToken(verifyAccessToken(tokenB))
    ).resolves.toBeNull()
    await expect(
      RefreshTokenModel.countDocuments({ userId: user._id })
    ).resolves.toBe(0)

    const newToken = signAccessToken({
      userId: user.id,
      tokenVersion: 1
    }).token
    await expect(
      authenticateAccessToken(verifyAccessToken(newToken))
    ).resolves.toBeTruthy()
  })

  it('rolls back refresh-token deletion when the version increment fails', async () => {
    const user = await UserModel.create({
      name: 'Rollback User',
      email: 'rollback@example.com',
      password: 'Password1!'
    })
    await RefreshTokenModel.create({
      userId: user._id,
      token: 'rollback-refresh-token',
      expiresAt: new Date(Date.now() + 60_000)
    })
    const incrementSpy = jest
      .spyOn(UserModel, 'findByIdAndUpdate')
      .mockRejectedValueOnce(new Error('increment failed'))

    await expect(revokeAllUserSessions(user.id)).rejects.toThrow(
      'increment failed'
    )

    await expect(
      RefreshTokenModel.countDocuments({ userId: user._id })
    ).resolves.toBe(1)
    incrementSpy.mockRestore()
  })
})

const redisGet = jest.fn()

jest.mock('../../config/redis.config', () => ({
  redis: {
    get: redisGet
  }
}))

import { Request, Response } from 'express'
import { checkBlacklist } from '../../middlewares/blacklist.middleware'
import { hashAccessTokenBlacklistKey } from '../../utils/secure-hash.util'

describe('blacklist middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redisGet.mockResolvedValue(null)
  })

  it('checks blacklist by access-token digest key', async () => {
    const next = jest.fn()
    const req = {
      headers: {
        authorization: 'Bearer raw-access-token'
      }
    } as Request

    await checkBlacklist(req, {} as Response, next)

    expect(redisGet).toHaveBeenCalledWith(
      `blacklist:${hashAccessTokenBlacklistKey('raw-access-token')}`
    )
    expect(redisGet).not.toHaveBeenCalledWith('blacklist:raw-access-token')
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects blacklisted tokens', async () => {
    redisGet.mockResolvedValueOnce('revoked')
    const next = jest.fn()
    const req = {
      headers: {
        authorization: 'Bearer raw-access-token'
      }
    } as Request

    await checkBlacklist(req, {} as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Token has been revoked',
        statusCode: 401
      })
    )
  })
})

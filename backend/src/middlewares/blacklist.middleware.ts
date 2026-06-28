import { Request, Response, NextFunction } from 'express'
import { redis } from '../config/redis.config'
import { UnauthorizedException } from '../utils/errors/index'
import { hashAccessTokenBlacklistKey } from '../utils/secure-hash.util'

export const checkBlacklist = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return next()

    const isBlacklisted = await redis.get(
      `blacklist:${hashAccessTokenBlacklistKey(token)}`
    )
    if (isBlacklisted) throw new UnauthorizedException('Token has been revoked')

    next()
  } catch (error) {
    next(error)
  }
}

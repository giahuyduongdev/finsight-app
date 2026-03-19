import { Request, Response, NextFunction } from 'express'
import { redis } from '../config/redis.config'
import { UnauthorizedException } from '../utils/app-error'

export const checkBlacklist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return next()

    const isBlacklisted = await redis.get(`blacklist:${token}`)
    if (isBlacklisted) throw new UnauthorizedException('Token has been revoked')

    next()
  } catch (error) {
    next(error)
  }
}

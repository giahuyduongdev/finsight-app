import { Request } from 'express'
import { UnauthorizedException } from './errors/index'
import { ErrorCodeEnum } from '../enums/error-code.enum'

/**
 * Helper function to safely extract userId from request
 * Throws UnauthorizedException if user is not authenticated
 */
export const getUserId = (req: Request): string => {
  const userId = req.user?._id
  if (!userId) {
    throw new UnauthorizedException(
      'User not authenticated',
      ErrorCodeEnum.ACCESS_UNAUTHORIZED
    )
  }
  return userId.toString()
}

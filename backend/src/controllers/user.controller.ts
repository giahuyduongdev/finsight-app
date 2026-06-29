import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { container } from '../container'
import { toCurrentUserDTO } from '../dtos/user.dto'
import { getUserId } from '../utils/getUserId.util'
import { ResponseFormatter } from '../utils/responseFormatter.util'
import { NotFoundException } from '../utils/errors'
import { getIO } from '../config/socket.config'
import { logger } from '../config/logger.config'
import { invalidateUserAnalyticsCache } from '../utils/cache.util'
import { emitAuthSessionRevoked } from '../utils/auth-socket.util'

// Get UserService instance from DI container
const userService = container.getUserService()

type ProfileUpdatedField =
  'name' | 'profilePicture' | 'timezone' | 'preferredCurrency'

const getChangedProfileFields = (
  body: Record<string, unknown>,
  profilePic?: Express.Multer.File
): ProfileUpdatedField[] => {
  const changedFields: ProfileUpdatedField[] = []

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    changedFields.push('name')
  }
  if (Object.prototype.hasOwnProperty.call(body, 'timezone')) {
    changedFields.push('timezone')
  }
  if (Object.prototype.hasOwnProperty.call(body, 'preferredCurrency')) {
    changedFields.push('preferredCurrency')
  }
  if (profilePic) {
    changedFields.push('profilePicture')
  }

  return changedFields
}

const emitProfileUpdated = (
  userId: string,
  changedFields: ProfileUpdatedField[]
) => {
  if (changedFields.length === 0) return

  try {
    getIO().to(userId).emit('user:profile-updated', {
      userId,
      changedFields,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    logger.warn('[APP:User] Failed to emit profile update socket event', {
      userId,
      changedFields,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

const shouldInvalidateAnalyticsCache = (changedFields: ProfileUpdatedField[]) =>
  changedFields.includes('timezone') ||
  changedFields.includes('preferredCurrency')

const invalidateAnalyticsCacheForProfileChange = async (
  userId: string,
  changedFields: ProfileUpdatedField[]
) => {
  if (!shouldInvalidateAnalyticsCache(changedFields)) return

  try {
    await invalidateUserAnalyticsCache(userId)
  } catch (error) {
    logger.warn(
      '[APP:User] Failed to invalidate analytics cache after profile update',
      {
        userId,
        changedFields,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    )
  }
}

export const getCurrentUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)

    const user = await userService.findById(userId)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(toCurrentUserDTO(user), {
        message: 'User fetched successfully'
      })
    )
  }
)

export const updateUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const userId = getUserId(req)
    const profilePic = req.file
    const changedFields = getChangedProfileFields(body, profilePic)

    const user = await userService.update(userId, body, profilePic)
    await invalidateAnalyticsCacheForProfileChange(userId, changedFields)
    emitProfileUpdated(userId, changedFields)

    return res.status(HTTPSTATUS.OK).json(
      ResponseFormatter.success(toCurrentUserDTO(user), {
        message: 'User profile updated successfully'
      })
    )
  }
)

export const changeUserPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const userId = getUserId(req)
    const result = await userService.changePassword(userId, body)
    emitAuthSessionRevoked(userId, 'password-changed')
    return res
      .status(HTTPSTATUS.OK)
      .json(ResponseFormatter.success(null, { message: result.message }))
  }
)

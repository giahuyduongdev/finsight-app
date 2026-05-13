import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { container } from '../container'
import { sanitizeUser } from '../dtos/user.dto'
import { getUserId } from '../utils/getUserId.util'

// Get UserService instance from DI container
const userService = container.getUserService()

export const getCurrentUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)

    const user = await userService.findById(userId)

    if (!user) {
      return res
        .status(HTTPSTATUS.NOT_FOUND)
        .json({ message: 'User not found' })
    }

    return res.status(HTTPSTATUS.OK).json({
      message: 'User fetched successfully',
      user: sanitizeUser(user)
    })
  }
)

export const updateUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const userId = getUserId(req)
    const profilePic = req.file

    const user = await userService.update(userId, body, profilePic)

    return res.status(HTTPSTATUS.OK).json({
      message: 'User profile updated successfully',
      data: sanitizeUser(user)
    })
  }
)

export const changeUserPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body
    const userId = getUserId(req)
    const result = await userService.changePassword(userId, body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

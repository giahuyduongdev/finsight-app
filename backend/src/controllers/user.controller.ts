import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import {
  changeUserPasswordService,
  findByIdUserService,
  updateUserService
} from '../services/user.service'
import {
  changePasswordSchema,
  updateUserSchema
} from '../validators/user.validator'
import { sanitizeUser } from '../dtos/user.dtos'
import { getUserId } from '../utils/getUserId.util'

export const getCurrentUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)

    const user = await findByIdUserService(userId)

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
    const body = updateUserSchema.parse(req.body)
    const userId = getUserId(req)
    const profilePic = req.file

    const user = await updateUserService(userId, body, profilePic)

    return res.status(HTTPSTATUS.OK).json({
      message: 'User profile updated successfully',
      data: sanitizeUser(user)
    })
  }
)

export const changeUserPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = changePasswordSchema.parse(req.body)
    const userId = getUserId(req) // ← lấy từ passport
    const result = await changeUserPasswordService(userId, body)
    return res.status(HTTPSTATUS.OK).json(result)
  }
)

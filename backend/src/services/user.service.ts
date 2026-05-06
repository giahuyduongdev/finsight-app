import UserModel from '../models/user.model'
import { NotFoundException, UnauthorizedException } from '../utils/errors/index'
import {
  ChangePasswordSchemaType,
  UpdateUserType
} from '../validators/user.validator'
import { redis } from '../config/redis.config'
import { compareValue } from '../utils/bcrypt.util'
import RefreshTokenModel from '../models/refresh-token.model'

export const findByIdUserService = async (userId: string) => {
  const user = await UserModel.findById(userId)
  return user?.omitPassword()
}

export const updateUserService = async (
  userId: string,
  body: UpdateUserType,
  profilePic?: Express.Multer.File
) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  if (profilePic) {
    user.profilePicture = profilePic.path
  }

  user.set({
    name: body.name,
    timezone: body.timezone,
    preferredCurrency: body.preferredCurrency
  })

  await redis.del(`user:${userId}`) // Xóa cache khi update
  await user.save()

  return user.omitPassword()
}

export const changeUserPasswordService = async (
  userId: string,
  body: ChangePasswordSchemaType
) => {
  const { currentPassword, newPassword } = body

  const user = await UserModel.findById(userId)
  if (!user) throw new NotFoundException('User not found')

  const isMatch = await compareValue(currentPassword, user.password)
  if (!isMatch) {
    throw new UnauthorizedException('Current password is incorrect')
  }

  user.password = newPassword
  await user.save()

  // Logout all devices
  await RefreshTokenModel.deleteMany({ userId: user._id })

  return {
    message: 'Password changed successfully. Please login again.'
  }
}

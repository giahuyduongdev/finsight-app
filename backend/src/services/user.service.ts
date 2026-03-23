import UserModel from '../models/user.model'
import { NotFoundException } from '../utils/app-error'
import { UpdateUserType } from '../validators/user.validator'
import { redis } from '../config/redis.config'

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

import mongoose from 'mongoose'
import RefreshTokenModel from '../models/refresh-token.model'
import UserModel from '../models/user.model'
import { NotFoundException } from '../utils/errors'

export const revokeAllUserSessions = async (
  userId: string
): Promise<number> => {
  const session = await mongoose.startSession()
  let tokenVersion: number | undefined

  try {
    await session.withTransaction(async () => {
      await RefreshTokenModel.deleteMany({ userId }, { session })

      const user = await UserModel.findByIdAndUpdate(
        userId,
        { $inc: { tokenVersion: 1 } },
        {
          new: true,
          projection: { tokenVersion: 1 },
          session
        }
      )

      if (!user) throw new NotFoundException('User not found')
      tokenVersion = user.tokenVersion
    })
  } finally {
    await session.endSession()
  }

  if (tokenVersion === undefined) {
    throw new Error('Session revocation transaction did not complete')
  }

  return tokenVersion
}

import UserModel from '../models/user.model'
import { UserWithoutPassword } from '../types/user.type'
import { ServiceUnavailableException } from '../utils/errors'

type AccessTokenAuthPayload = {
  userId?: string
  tokenVersion?: number
}

export const authenticateAccessToken = async (
  payload: AccessTokenAuthPayload
): Promise<UserWithoutPassword | null> => {
  if (
    !payload.userId ||
    !Number.isInteger(payload.tokenVersion) ||
    (payload.tokenVersion as number) < 0
  ) {
    return null
  }

  let user
  try {
    user = await UserModel.findById(payload.userId).select('+tokenVersion')
  } catch {
    throw new ServiceUnavailableException('Authentication service unavailable')
  }

  if (!user) return null

  const currentTokenVersion = user.tokenVersion ?? 0
  if (currentTokenVersion !== payload.tokenVersion) return null

  return user.omitPassword()
}

import {
  AuthUserDTO,
  CurrentUserDTO,
  PublicUserDTO,
  UserResponseDTO
} from '../types/dto.type'

type UserDTOInput = {
  _id?: unknown
  name?: unknown
  email?: unknown
  profilePicture?: unknown
  timezone?: unknown
  preferredCurrency?: unknown
  role?: unknown
  toObject?: () => Record<string, unknown>
}

const toPlainUser = (user: UserDTOInput): Record<string, unknown> =>
  user.toObject ? user.toObject() : (user as unknown as Record<string, unknown>)

const getUserId = (userData: Record<string, unknown>): string =>
  String(
    userData._id &&
      typeof userData._id === 'object' &&
      'toString' in userData._id
      ? userData._id.toString()
      : userData._id
  )

/**
 * Maps the authenticated user's own profile to the API response shape.
 */
export const toCurrentUserDTO = (user: UserDTOInput): CurrentUserDTO => {
  const userData = toPlainUser(user)

  return {
    id: getUserId(userData),
    name: String(userData.name),
    email: String(userData.email),
    profilePicture: (userData.profilePicture as string | null) || null,
    timezone: String(userData.timezone),
    preferredCurrency: String(userData.preferredCurrency),
    role: String(userData.role)
  }
}

/**
 * Maps user data for auth responses that initialize client session state.
 */
export const toAuthUserDTO = (user: UserDTOInput): AuthUserDTO =>
  toCurrentUserDTO(user)

/**
 * Maps user data safe for other users or embedded public references.
 */
export const toPublicUserDTO = (user: UserDTOInput): PublicUserDTO => {
  const userData = toPlainUser(user)

  return {
    id: getUserId(userData),
    name: String(userData.name),
    profilePicture: (userData.profilePicture as string | null) || null
  }
}

export const sanitizeUser = (user: UserDTOInput): UserResponseDTO =>
  toCurrentUserDTO(user)

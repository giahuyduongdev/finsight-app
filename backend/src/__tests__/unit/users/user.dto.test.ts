import {
  sanitizeUser,
  toAuthUserDTO,
  toCurrentUserDTO,
  toPublicUserDTO
} from '../../../dtos/user.dto'

const createUser = () => ({
  _id: { toString: () => 'user-123' },
  name: 'Test User',
  email: 'test@example.com',
  profilePicture: null,
  timezone: 'Asia/Ho_Chi_Minh',
  preferredCurrency: 'USD',
  role: 'USER'
})

describe('user DTO mappers', () => {
  it('includes email for the current user DTO', () => {
    expect(toCurrentUserDTO(createUser())).toEqual({
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      profilePicture: null,
      timezone: 'Asia/Ho_Chi_Minh',
      preferredCurrency: 'USD',
      role: 'USER'
    })
  })

  it('includes email for the auth user DTO', () => {
    expect(toAuthUserDTO(createUser())).toEqual(
      expect.objectContaining({
        id: 'user-123',
        email: 'test@example.com'
      })
    )
  })

  it('excludes email from the public user DTO', () => {
    const dto = toPublicUserDTO(createUser())

    expect(dto).toEqual({
      id: 'user-123',
      name: 'Test User',
      profilePicture: null
    })
    expect(dto).not.toHaveProperty('email')
  })

  it('keeps sanitizeUser as a compatibility alias for current user DTO', () => {
    expect(sanitizeUser(createUser())).toEqual(toCurrentUserDTO(createUser()))
  })
})

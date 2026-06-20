import UserModel from '../../models/user.model'

describe('user token version', () => {
  it('is internal, non-negative, and defaults to zero', () => {
    const tokenVersionPath = UserModel.schema.path('tokenVersion')

    expect(tokenVersionPath).toBeDefined()
    expect(tokenVersionPath.options).toEqual(
      expect.objectContaining({
        default: 0,
        min: 0,
        select: false
      })
    )
  })

  it('does not expose the token version in sanitized user data', () => {
    const user = new UserModel({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password',
      tokenVersion: 4
    })

    expect(user.omitPassword()).not.toHaveProperty('tokenVersion')
  })
})

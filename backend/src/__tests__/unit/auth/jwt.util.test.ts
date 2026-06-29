import { signAccessToken, verifyAccessToken } from '../../../utils/jwt.util'

describe('access token versioning', () => {
  it('preserves the token version through signing and verification', () => {
    const { token } = signAccessToken({
      userId: 'user-123',
      tokenVersion: 7
    })

    expect(verifyAccessToken(token)).toEqual(
      expect.objectContaining({
        userId: 'user-123',
        tokenVersion: 7
      })
    )
  })
})

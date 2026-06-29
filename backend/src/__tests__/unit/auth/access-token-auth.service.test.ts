import UserModel from '../../../models/user.model'
import { authenticateAccessToken } from '../../../services/access-token-auth.service'

jest.mock('../../../models/user.model', () => ({
  __esModule: true,
  default: {
    findById: jest.fn()
  }
}))

const findByIdMock = UserModel.findById as jest.Mock

const mockUserLookup = (result: unknown) => {
  const select = jest.fn().mockResolvedValue(result)
  findByIdMock.mockReturnValue({ select })
  return select
}

describe('access token authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('accepts a token whose version matches the user', async () => {
    const safeUser = { id: 'user-123', email: 'user@example.com' }
    const omitPassword = jest.fn().mockReturnValue(safeUser)
    mockUserLookup({ tokenVersion: 3, omitPassword })

    await expect(
      authenticateAccessToken({ userId: 'user-123', tokenVersion: 3 })
    ).resolves.toEqual(safeUser)
  })

  it('rejects a token whose version does not match the user', async () => {
    const omitPassword = jest.fn()
    mockUserLookup({ tokenVersion: 4, omitPassword })

    await expect(
      authenticateAccessToken({ userId: 'user-123', tokenVersion: 3 })
    ).resolves.toBeNull()
    expect(omitPassword).not.toHaveBeenCalled()
  })

  it('rejects a legacy token without a version claim', async () => {
    await expect(
      authenticateAccessToken({ userId: 'user-123' })
    ).resolves.toBeNull()
    expect(findByIdMock).not.toHaveBeenCalled()
  })

  it('rejects a token for a deleted user', async () => {
    mockUserLookup(null)

    await expect(
      authenticateAccessToken({ userId: 'user-123', tokenVersion: 3 })
    ).resolves.toBeNull()
  })

  it('fails closed with service unavailable when MongoDB cannot verify state', async () => {
    const select = jest.fn().mockRejectedValue(new Error('database offline'))
    findByIdMock.mockReturnValue({ select })

    await expect(
      authenticateAccessToken({ userId: 'user-123', tokenVersion: 3 })
    ).rejects.toEqual(
      expect.objectContaining({
        message: 'Authentication service unavailable',
        statusCode: 503
      })
    )
  })
})

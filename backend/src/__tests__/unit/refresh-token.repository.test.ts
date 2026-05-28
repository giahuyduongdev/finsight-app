const mockCreate = jest.fn()
const mockFindOne = jest.fn()
const mockFindOneAndUpdate = jest.fn()

jest.mock('../../models/refresh-token.model', () => ({
  __esModule: true,
  default: {
    create: (...args: unknown[]) => mockCreate(...args),
    findOne: (...args: unknown[]) => mockFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args)
  }
}))

import { RefreshTokenRepository } from '../../repositories/refresh-token.repository'
import { hashRefreshToken } from '../../utils/secure-hash.util'

const execResult = <T>(value: T) => ({
  exec: jest.fn().mockResolvedValue(value)
})

describe('RefreshTokenRepository', () => {
  const repository = new RefreshTokenRepository()

  beforeEach(() => {
    mockCreate.mockReset()
    mockFindOne.mockReset()
    mockFindOneAndUpdate.mockReset()
  })

  it('should find hashed refresh tokens first', async () => {
    const token = 'refresh-token'
    const tokenHash = hashRefreshToken(token)
    const refreshToken = { token: tokenHash }

    mockFindOne.mockReturnValueOnce(execResult(refreshToken))

    await expect(repository.findByToken(token)).resolves.toBe(refreshToken)
    expect(mockFindOne).toHaveBeenCalledTimes(1)
    expect(mockFindOne).toHaveBeenCalledWith({ token: tokenHash })
  })

  it('should migrate plaintext refresh tokens on lookup', async () => {
    const token = 'legacy-refresh-token'
    const tokenHash = hashRefreshToken(token)
    const refreshToken = {
      token,
      save: jest.fn().mockResolvedValue({ token: tokenHash })
    }

    mockFindOne
      .mockReturnValueOnce(execResult(null))
      .mockReturnValueOnce(execResult(refreshToken))

    await expect(repository.findByToken(token)).resolves.toEqual({
      token: tokenHash
    })
    expect(refreshToken.token).toBe(tokenHash)
    expect(refreshToken.save).toHaveBeenCalled()
  })

  it('should revoke either hashed or legacy plaintext refresh tokens', async () => {
    const token = 'legacy-refresh-token'
    const tokenHash = hashRefreshToken(token)

    mockFindOneAndUpdate.mockReturnValueOnce(execResult({ token: tokenHash }))

    await expect(repository.revokeToken(token)).resolves.toBe(true)
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { token: { $in: [tokenHash, token] } },
      { $set: { token: tokenHash, isRevoked: true } }
    )
  })
})

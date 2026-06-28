const createMock = jest.fn()
const findOneExecMock = jest.fn()
const findOneMock = jest.fn(() => ({ exec: findOneExecMock }))
const updateOneExecMock = jest.fn()
const updateOneMock = jest.fn(() => ({ exec: updateOneExecMock }))

jest.mock('../../models/refresh-token.model', () => ({
  __esModule: true,
  default: {
    create: createMock,
    findOne: findOneMock,
    updateOne: updateOneMock,
    find: jest.fn(() => ({ sort: jest.fn(() => ({ exec: jest.fn() })) })),
    deleteMany: jest.fn(() => ({ exec: jest.fn() }))
  }
}))

import { RefreshTokenRepository } from '../../repositories/refresh-token.repository'
import { hashRefreshToken } from '../../utils/secure-hash.util'

describe('refresh token repository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createMock.mockImplementation(async (data) => data)
    findOneExecMock.mockResolvedValue(null)
    updateOneExecMock.mockResolvedValue({ modifiedCount: 1 })
  })

  it('stores refresh token digests instead of raw tokens', async () => {
    const repository = new RefreshTokenRepository()

    await repository.create({
      token: 'raw-refresh-token'
    } as never)

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: hashRefreshToken('raw-refresh-token')
      })
    )
    expect(createMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'raw-refresh-token'
      })
    )
  })

  it('finds refresh tokens by digest', async () => {
    const repository = new RefreshTokenRepository()

    await repository.findByToken('raw-refresh-token')

    expect(findOneMock).toHaveBeenCalledWith({
      token: hashRefreshToken('raw-refresh-token')
    })
  })

  it('revokes refresh tokens by digest', async () => {
    const repository = new RefreshTokenRepository()

    await expect(repository.revokeToken('raw-refresh-token')).resolves.toBe(
      true
    )

    expect(updateOneMock).toHaveBeenCalledWith(
      { token: hashRefreshToken('raw-refresh-token') },
      { $set: { isRevoked: true } }
    )
  })
})

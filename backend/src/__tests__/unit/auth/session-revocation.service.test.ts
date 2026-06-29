import mongoose from 'mongoose'
import UserModel from '../../../models/user.model'
import RefreshTokenModel from '../../../models/refresh-token.model'
import { revokeAllUserSessions } from '../../../services/session-revocation.service'

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    startSession: jest.fn()
  }
}))

jest.mock('../../../models/user.model', () => ({
  __esModule: true,
  default: {
    findByIdAndUpdate: jest.fn()
  }
}))

jest.mock('../../../models/refresh-token.model', () => ({
  __esModule: true,
  default: {
    deleteMany: jest.fn()
  }
}))

const findByIdAndUpdateMock = UserModel.findByIdAndUpdate as jest.Mock
const deleteManyMock = RefreshTokenModel.deleteMany as jest.Mock

describe('account-wide session revocation', () => {
  const session = {
    withTransaction: jest.fn(async (operation: () => Promise<void>) =>
      operation()
    ),
    endSession: jest.fn().mockResolvedValue(undefined)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(mongoose.startSession as jest.Mock).mockResolvedValue(session)
  })

  it('revokes refresh tokens and increments the version in one transaction', async () => {
    findByIdAndUpdateMock.mockResolvedValue({ tokenVersion: 6 })
    deleteManyMock.mockResolvedValue({ deletedCount: 2 })

    await expect(revokeAllUserSessions('user-123')).resolves.toBe(6)

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-123',
      { $inc: { tokenVersion: 1 } },
      expect.objectContaining({
        new: true,
        session
      })
    )
    expect(RefreshTokenModel.deleteMany).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { session }
    )
    expect(session.withTransaction).toHaveBeenCalledTimes(1)
    expect(session.endSession).toHaveBeenCalledTimes(1)
  })
})

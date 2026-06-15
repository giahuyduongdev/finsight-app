import { NextFunction, Request, Response } from 'express'
import { HTTPSTATUS } from '../../config/http.config'

const mockUpdate = jest.fn()
const mockFindById = jest.fn()
const mockEmit = jest.fn()
const mockTo = jest.fn(() => ({ emit: mockEmit }))
const mockGetIO = jest.fn(() => ({ to: mockTo }))
const mockLoggerWarn = jest.fn()

jest.mock('../../container', () => ({
  container: {
    getUserService: () => ({
      findById: (...args: unknown[]) => mockFindById(...args),
      update: (...args: unknown[]) => mockUpdate(...args)
    })
  }
}))

jest.mock('../../config/socket.config', () => ({
  getIO: () => mockGetIO()
}))

jest.mock('../../config/logger.config', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

jest.mock('../../utils/getUserId.util', () => ({
  getUserId: () => 'user-123'
}))

import { updateUserController } from '../../controllers/user.controller'

const createUser = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'user-123' },
  name: 'Test User',
  email: 'test@example.com',
  profilePicture: null,
  timezone: 'Asia/Ho_Chi_Minh',
  preferredCurrency: 'USD',
  role: 'USER',
  ...overrides
})

describe('user.controller', () => {
  let mockResponse: Partial<Response>
  let nextMock: jest.MockedFunction<NextFunction>
  let statusMock: jest.Mock
  let jsonMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    jsonMock = jest.fn()
    mockResponse = {
      json: jsonMock
    }
    statusMock = jest.fn().mockReturnValue(mockResponse)
    mockResponse.status = statusMock
    nextMock = jest.fn()
  })

  describe('updateUserController', () => {
    it('emits profile update event with changed fields after successful update', async () => {
      mockUpdate.mockResolvedValue(createUser())

      const mockRequest = {
        body: {
          name: 'Test User',
          timezone: 'Asia/Ho_Chi_Minh',
          preferredCurrency: 'VND'
        },
        file: { path: 'https://cdn.example.com/avatar.jpg' }
      } as unknown as Request

      await updateUserController(
        mockRequest,
        mockResponse as Response,
        nextMock
      )

      expect(mockUpdate).toHaveBeenCalledWith(
        'user-123',
        mockRequest.body,
        mockRequest.file
      )
      expect(mockTo).toHaveBeenCalledWith('user-123')
      expect(mockEmit).toHaveBeenCalledWith('user:profile-updated', {
        userId: 'user-123',
        changedFields: [
          'name',
          'timezone',
          'preferredCurrency',
          'profilePicture'
        ],
        updatedAt: expect.any(String)
      })
      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'user-123',
          timezone: 'Asia/Ho_Chi_Minh',
          preferredCurrency: 'USD'
        }),
        meta: { message: 'User profile updated successfully' }
      })
      expect(nextMock).not.toHaveBeenCalled()
    })

    it('does not fail the profile update response when socket emit fails', async () => {
      mockUpdate.mockResolvedValue(createUser())
      mockGetIO.mockImplementationOnce(() => {
        throw new Error('Socket unavailable')
      })

      const mockRequest = {
        body: {
          timezone: 'Asia/Ho_Chi_Minh'
        }
      } as Request

      await updateUserController(
        mockRequest,
        mockResponse as Response,
        nextMock
      )

      expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: 'user-123' })
        })
      )
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '[APP:User] Failed to emit profile update socket event',
        expect.objectContaining({
          userId: 'user-123',
          changedFields: ['timezone'],
          error: 'Socket unavailable'
        })
      )
      expect(nextMock).not.toHaveBeenCalled()
    })
  })
})

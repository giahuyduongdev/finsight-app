import { NextFunction, Request, Response } from 'express'
import { HTTPSTATUS } from '../../../config/http.config'
import {
  getNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController
} from '../../../controllers/notification.controller'

const mockFindByUserId = jest.fn()
const mockMarkAsRead = jest.fn()
const mockMarkAllAsRead = jest.fn()

jest.mock('../../../container', () => ({
  container: {
    getNotificationService: () => ({
      findByUserId: (...args: unknown[]) => mockFindByUserId(...args),
      markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
      markAllAsRead: (...args: unknown[]) => mockMarkAllAsRead(...args)
    })
  }
}))

jest.mock('../../../utils/getUserId.util', () => ({
  getUserId: () => 'user-123'
}))

const createNotification = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'notification-123' },
  userId: { toString: () => 'user-123' },
  type: 'bulk_import.completed',
  title: 'Transactions imported',
  description: 'Successfully imported 12 transactions',
  severity: 'success',
  unread: true,
  actionUrl: '/transactions',
  metadata: { entityType: 'import' },
  readAt: null,
  createdAt: new Date('2026-07-08T00:00:00.000Z'),
  updatedAt: new Date('2026-07-08T00:00:00.000Z'),
  ...overrides
})

describe('notification.controller', () => {
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

  it('returns current user notifications with unread count', async () => {
    mockFindByUserId.mockResolvedValue({
      data: [createNotification()],
      unreadCount: 2,
      pagination: {
        pageSize: 20,
        pageNumber: 1,
        totalCount: 1,
        totalPages: 1,
        skip: 0
      }
    })

    const request = {
      query: { unreadOnly: 'true' },
      originalUrl: '/api/v1/notifications',
      path: '/api/v1/notifications'
    } as unknown as Request

    await getNotificationsController(
      request,
      mockResponse as Response,
      nextMock
    )

    expect(mockFindByUserId).toHaveBeenCalledWith('user-123', {
      pageNumber: 1,
      pageSize: 20,
      unreadOnly: true
    })
    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(jsonMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          _id: 'notification-123',
          type: 'bulk_import.completed',
          unread: true
        })
      ],
      meta: expect.objectContaining({
        unreadCount: 2,
        pagination: expect.objectContaining({
          pageSize: 20,
          pageNumber: 1,
          totalCount: 1
        })
      }),
      links: expect.any(Object)
    })
    expect(nextMock).not.toHaveBeenCalled()
  })

  it('marks one current user notification as read', async () => {
    mockMarkAsRead.mockResolvedValue(
      createNotification({
        unread: false,
        readAt: new Date('2026-07-08T00:01:00.000Z')
      })
    )

    const request = {
      params: { notificationId: 'notification-123' }
    } as unknown as Request

    await markNotificationReadController(
      request,
      mockResponse as Response,
      nextMock
    )

    expect(mockMarkAsRead).toHaveBeenCalledWith('user-123', 'notification-123')
    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(jsonMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        _id: 'notification-123',
        unread: false,
        readAt: '2026-07-08T00:01:00.000Z'
      })
    })
  })

  it('marks all current user notifications as read', async () => {
    mockMarkAllAsRead.mockResolvedValue({ updatedCount: 3, unreadCount: 0 })

    await markAllNotificationsReadController(
      {} as Request,
      mockResponse as Response,
      nextMock
    )

    expect(mockMarkAllAsRead).toHaveBeenCalledWith('user-123')
    expect(statusMock).toHaveBeenCalledWith(HTTPSTATUS.OK)
    expect(jsonMock).toHaveBeenCalledWith({
      data: { updatedCount: 3, unreadCount: 0 }
    })
  })
})

import mongoose from 'mongoose'
import { NotificationService } from '../../../services/notification.service'
import { INotificationRepository } from '../../../repositories/interfaces/notification-repository.interface'
import { NotificationDocument } from '../../../models/notification.model'

const mockEmit = jest.fn()
const mockTo = jest.fn(() => ({ emit: mockEmit }))
const mockGetIO = jest.fn(() => ({ to: mockTo }))
const mockLoggerWarn = jest.fn()

jest.mock('../../../config/socket.config', () => ({
  getIO: () => mockGetIO()
}))

jest.mock('../../../config/logger.config', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

const createNotificationDocument = (
  overrides: Partial<NotificationDocument> = {}
): NotificationDocument =>
  ({
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
    userId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
    type: 'receipt_scan.completed',
    title: 'Receipt scan completed',
    description: 'Receipt scan data is ready to review',
    severity: 'success',
    unread: true,
    actionUrl: '/transactions',
    metadata: { entityType: 'receipt' },
    readAt: null,
    createdAt: new Date('2026-07-08T00:00:00.000Z'),
    updatedAt: new Date('2026-07-08T00:00:00.000Z'),
    ...overrides
  }) as NotificationDocument

describe('NotificationService', () => {
  let repository: jest.Mocked<INotificationRepository>
  let service: NotificationService

  beforeEach(() => {
    jest.clearAllMocks()
    repository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      countUnreadByUserId: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn()
    }
    service = new NotificationService(repository)
  })

  it('persists and emits notification:created to the user room', async () => {
    const notification = createNotificationDocument()
    repository.create.mockResolvedValue(notification)

    await service.create({
      userId: notification.userId.toString(),
      type: notification.type,
      title: notification.title,
      description: notification.description,
      severity: notification.severity,
      actionUrl: notification.actionUrl,
      metadata: notification.metadata
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: notification.userId.toString(),
        type: 'receipt_scan.completed'
      })
    )
    expect(mockTo).toHaveBeenCalledWith(notification.userId.toString())
    expect(mockEmit).toHaveBeenCalledWith(
      'notification:created',
      expect.objectContaining({
        _id: notification._id.toString(),
        type: 'receipt_scan.completed',
        unread: true,
        actionUrl: '/transactions'
      })
    )
  })

  it('keeps the persisted notification when socket emit fails', async () => {
    const notification = createNotificationDocument()
    repository.create.mockResolvedValue(notification)
    mockGetIO.mockImplementationOnce(() => {
      throw new Error('Socket unavailable')
    })

    await expect(
      service.create({
        userId: notification.userId.toString(),
        type: notification.type,
        title: notification.title,
        severity: notification.severity
      })
    ).resolves.toEqual(notification)

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[APP:Notification] Failed to emit notification event',
      expect.objectContaining({
        userId: notification.userId.toString(),
        notificationId: notification._id.toString(),
        type: notification.type,
        error: 'Socket unavailable'
      })
    )
  })

  it('returns unread count with paginated notifications', async () => {
    const notification = createNotificationDocument()
    repository.findByUserId.mockResolvedValue({
      data: [notification],
      pagination: {
        pageNumber: 1,
        pageSize: 20,
        totalCount: 1,
        totalPages: 1,
        skip: 0
      }
    })
    repository.countUnreadByUserId.mockResolvedValue(1)

    const result = await service.findByUserId(notification.userId.toString(), {
      pageNumber: 1,
      pageSize: 20
    })

    expect(result.unreadCount).toBe(1)
    expect(result.data).toEqual([notification])
  })

  it('throws not found when marking another user notification as read', async () => {
    repository.markAsRead.mockResolvedValue(null)

    await expect(
      service.markAsRead('user-123', '507f1f77bcf86cd799439011')
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Notification not found'
    })
  })
})

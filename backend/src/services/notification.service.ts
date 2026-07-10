import { getIO } from '../config/socket.config'
import { logger } from '../config/logger.config'
import { toNotificationResponse } from '../dtos/notification.dto'
import { NotificationDocument } from '../models/notification.model'
import {
  CreateNotificationInput,
  FindNotificationsOptions,
  INotificationRepository
} from '../repositories/interfaces/notification-repository.interface'
import { PaginatedResult } from '../types/repository.type'
import { NotFoundException } from '../utils/errors'

export class NotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationDocument> {
    const notification = await this.notificationRepository.create(input)
    this.emitCreated(notification)
    return notification
  }

  async findByUserId(
    userId: string,
    options: FindNotificationsOptions
  ): Promise<PaginatedResult<NotificationDocument> & { unreadCount: number }> {
    const [result, unreadCount] = await Promise.all([
      this.notificationRepository.findByUserId(userId, options),
      this.notificationRepository.countUnreadByUserId(userId)
    ])

    return {
      ...result,
      unreadCount
    }
  }

  async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<NotificationDocument> {
    const notification = await this.notificationRepository.markAsRead(
      userId,
      notificationId
    )

    if (!notification) {
      throw new NotFoundException('Notification not found')
    }

    return notification
  }

  async markAllAsRead(
    userId: string
  ): Promise<{ updatedCount: number; unreadCount: number }> {
    const result = await this.notificationRepository.markAllAsRead(userId)
    return {
      updatedCount: result.updatedCount,
      unreadCount: 0
    }
  }

  private emitCreated(notification: NotificationDocument): void {
    const userId = notification.userId.toString()

    try {
      getIO()
        .to(userId)
        .emit('notification:created', toNotificationResponse(notification))
    } catch (error) {
      logger.warn('[APP:Notification] Failed to emit notification event', {
        userId,
        notificationId: notification._id.toString(),
        type: notification.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

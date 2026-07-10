import {
  NotificationDocument,
  NotificationMetadata,
  NotificationSeverity
} from '../../models/notification.model'
import { PaginatedResult, PaginationParams } from '../../types/repository.type'

export interface CreateNotificationInput {
  userId: string
  type: string
  title: string
  description?: string
  severity: NotificationSeverity
  actionUrl?: string
  metadata?: NotificationMetadata
  idempotencyKey?: string
}

export interface FindNotificationsOptions extends PaginationParams {
  unreadOnly?: boolean
}

export interface MarkAllAsReadResult {
  updatedCount: number
}

export interface INotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationDocument>
  findByUserId(
    userId: string,
    options: FindNotificationsOptions
  ): Promise<PaginatedResult<NotificationDocument>>
  countUnreadByUserId(userId: string): Promise<number>
  markAsRead(
    userId: string,
    notificationId: string
  ): Promise<NotificationDocument | null>
  markAllAsRead(userId: string): Promise<MarkAllAsReadResult>
}

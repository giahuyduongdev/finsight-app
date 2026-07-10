import { NotificationDocument } from '../models/notification.model'

export interface NotificationResponseDTO {
  _id: string
  type: string
  title: string
  description?: string
  severity: string
  unread: boolean
  actionUrl?: string
  metadata?: Record<string, unknown>
  createdAt: string
  readAt?: string | null
}

export const toNotificationResponse = (
  notification: NotificationDocument
): NotificationResponseDTO => ({
  _id: notification._id.toString(),
  type: notification.type,
  title: notification.title,
  description: notification.description,
  severity: notification.severity,
  unread: notification.unread,
  actionUrl: notification.actionUrl,
  metadata: notification.metadata,
  createdAt: notification.createdAt.toISOString(),
  readAt: notification.readAt ? notification.readAt.toISOString() : null
})

export const toNotificationListResponse = (
  notifications: NotificationDocument[]
): NotificationResponseDTO[] => notifications.map(toNotificationResponse)

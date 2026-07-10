export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface NotificationMetadata {
  entityType?: string
  entityId?: string
  highlightId?: string
  [key: string]: unknown
}

export interface NotificationItem {
  _id: string
  type: string
  title: string
  description?: string
  severity: NotificationSeverity
  unread: boolean
  actionUrl?: string
  metadata?: NotificationMetadata
  createdAt: string
  readAt?: string | null
}

export interface NotificationListResponse {
  data: NotificationItem[]
  meta?: {
    unreadCount?: number
    pagination?: {
      pageSize: number
      pageNumber: number
      totalCount: number
      totalPages: number
    }
  }
}

export interface MarkAllNotificationsReadResponse {
  data: {
    updatedCount: number
    unreadCount: number
  }
}

export interface MarkNotificationReadResponse {
  data: NotificationItem
}

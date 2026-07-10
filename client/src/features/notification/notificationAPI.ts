import { apiClient } from '@/app/api-client'
import {
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationItem,
  NotificationListResponse
} from './notificationType'

const sortNotifications = (notifications: NotificationItem[]) =>
  [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

export const notificationApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<NotificationListResponse, void>({
      query: () => ({
        url: '/notifications',
        method: 'GET'
      }),
      providesTags: ['notifications']
    }),

    markNotificationRead: builder.mutation<
      MarkNotificationReadResponse,
      string
    >({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'PATCH'
      }),
      async onQueryStarted(notificationId, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationApi.util.updateQueryData(
            'getNotifications',
            undefined,
            (draft) => {
              const notification = draft.data.find(
                (item) => item._id === notificationId
              )
              if (!notification || !notification.unread) return
              notification.unread = false
              notification.readAt = new Date().toISOString()
              draft.meta = {
                ...draft.meta,
                unreadCount: Math.max((draft.meta?.unreadCount || 1) - 1, 0)
              }
            }
          )
        )

        try {
          const { data } = await queryFulfilled
          dispatch(
            notificationApi.util.updateQueryData(
              'getNotifications',
              undefined,
              (draft) => {
                const index = draft.data.findIndex(
                  (item) => item._id === notificationId
                )
                if (index >= 0) {
                  draft.data[index] = data.data
                }
              }
            )
          )
        } catch {
          patch.undo()
        }
      }
    }),

    markAllNotificationsRead: builder.mutation<
      MarkAllNotificationsReadResponse,
      void
    >({
      query: () => ({
        url: '/notifications/read-all',
        method: 'PATCH'
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const readAt = new Date().toISOString()
        const patch = dispatch(
          notificationApi.util.updateQueryData(
            'getNotifications',
            undefined,
            (draft) => {
              draft.data.forEach((notification) => {
                notification.unread = false
                notification.readAt = notification.readAt || readAt
              })
              draft.meta = {
                ...draft.meta,
                unreadCount: 0
              }
            }
          )
        )

        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      }
    })
  })
})

export const upsertNotification = (
  notifications: NotificationItem[],
  notification: NotificationItem
) => {
  const existingIndex = notifications.findIndex(
    (item) => item._id === notification._id
  )

  if (existingIndex >= 0) {
    const next = [...notifications]
    next[existingIndex] = notification
    return sortNotifications(next)
  }

  return sortNotifications([notification, ...notifications]).slice(0, 20)
}

export const {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation
} = notificationApi

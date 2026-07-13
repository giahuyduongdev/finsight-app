import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation
} from '@/features/notification/notificationAPI'
import { NotificationItem } from '@/features/notification/notificationType'
import { cn } from '@/lib/utils'

const notificationDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric'
})

const formatNotificationTime = (createdAt: string) => {
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return ''

  const diffMs = Date.now() - created
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

  return notificationDateFormatter.format(new Date(createdAt))
}

export function NotificationNav() {
  const navigate = useNavigate()
  const { data, isLoading } = useGetNotificationsQuery()
  const [markNotificationRead] = useMarkNotificationReadMutation()
  const [markAllNotificationsRead, { isLoading: isMarkingAllRead }] =
    useMarkAllNotificationsReadMutation()

  const notifications = data?.data || []
  const unreadCount =
    data?.meta?.unreadCount ??
    notifications.filter((notification) => notification.unread).length
  const hasUnreadNotifications = unreadCount > 0

  const handleNotificationSelect = async (
    event: Event,
    notification: NotificationItem
  ) => {
    event.preventDefault()

    if (notification.unread) {
      await markNotificationRead(notification._id)
    }

    if (notification.actionUrl) {
      navigate(notification.actionUrl)
    }
  }

  const handleMarkAllRead = async (event: Event) => {
    event.preventDefault()
    if (!hasUnreadNotifications || isMarkingAllRead) return

    await markAllNotificationsRead()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full !bg-transparent text-white hover:!bg-white/10 hover:!text-white"
          aria-label="Open notifications"
        >
          <Bell className="h-5 w-5" />
          {hasUnreadNotifications && (
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border border-[var(--secondary-dark-color)] bg-red-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 !bg-[var(--secondary-dark-color)] !text-white !border-gray-700"
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="flex items-start justify-between gap-3">
          <span className="flex flex-col items-start gap-1">
            <span className="font-semibold">Notifications</span>
            <span className="text-[13px] font-light text-gray-400">
              Recent activity in your account
            </span>
          </span>
          {hasUnreadNotifications && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isMarkingAllRead}
              onClick={(event) => handleMarkAllRead(event.nativeEvent)}
              className="h-7 w-7 shrink-0 !bg-transparent text-gray-300 hover:!bg-white/10 hover:!text-white"
              aria-label="Mark all notifications as read"
              title="Mark all as read"
            >
              {isMarkingAllRead ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="!bg-gray-700" />
        <DropdownMenuGroup>
          {isLoading ? (
            <div className="flex items-center justify-center px-4 py-6 text-sm text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading notifications
            </div>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification._id}
                onSelect={(event) =>
                  handleNotificationSelect(event, notification)
                }
                className={cn(
                  'flex cursor-pointer items-start gap-3 py-3 hover:!bg-gray-800 hover:!text-white',
                  notification.unread && 'bg-white/[0.03]'
                )}
              >
                <span
                  className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    notification.unread ? 'bg-red-500' : 'bg-gray-600'
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span
                    className={cn(
                      'text-sm',
                      notification.unread ? 'font-semibold' : 'font-medium'
                    )}
                  >
                    {notification.title}
                  </span>
                  {notification.description && (
                    <span className="text-[13px] leading-5 text-gray-400">
                      {notification.description}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatNotificationTime(notification.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No notifications yet.
            </div>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

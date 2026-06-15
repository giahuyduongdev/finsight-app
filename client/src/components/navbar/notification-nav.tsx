import { Bell } from 'lucide-react'
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

type NotificationItem = {
  id: string
  title: string
  description: string
  time: string
  unread: boolean
}

const notifications: NotificationItem[] = [
  {
    id: 'budget-warning',
    title: 'Budget threshold reached',
    description: 'Dining expenses are close to this month budget.',
    time: '5 min ago',
    unread: true
  },
  {
    id: 'transaction-import',
    title: 'Transactions imported',
    description: '12 new transactions were added successfully.',
    time: '1 hour ago',
    unread: true
  },
  {
    id: 'rate-update',
    title: 'Exchange rates updated',
    description: 'Latest currency rates are ready to use.',
    time: 'Today',
    unread: false
  }
]

export function NotificationNav() {
  const hasUnreadNotifications = notifications.some(
    (notification) => notification.unread
  )

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
        <DropdownMenuLabel className="flex flex-col items-start gap-1">
          <span className="font-semibold">Notifications</span>
          <span className="text-[13px] font-light text-gray-400">
            Recent activity in your account
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="!bg-gray-700" />
        <DropdownMenuGroup>
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex cursor-default items-start gap-3 py-3 hover:!bg-gray-800 hover:!text-white"
              >
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${
                    notification.unread ? 'bg-red-500' : 'bg-gray-600'
                  }`}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">
                    {notification.title}
                  </span>
                  <span className="text-[13px] leading-5 text-gray-400">
                    {notification.description}
                  </span>
                  <span className="text-xs text-gray-500">
                    {notification.time}
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

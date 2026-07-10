import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationNav } from './notification-nav'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  useGetNotificationsQuery: vi.fn()
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate
}))

vi.mock('@/features/notification/notificationAPI', () => ({
  useGetNotificationsQuery: mocks.useGetNotificationsQuery,
  useMarkNotificationReadMutation: () => [mocks.markNotificationRead],
  useMarkAllNotificationsReadMutation: () => [
    mocks.markAllNotificationsRead,
    { isLoading: false }
  ]
}))

const openNotifications = () => {
  const trigger = screen.getByLabelText('Open notifications')
  fireEvent.pointerDown(trigger)
  fireEvent.mouseDown(trigger)
  fireEvent.click(trigger)
}

describe('NotificationNav', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.markNotificationRead.mockResolvedValue({})
    mocks.markAllNotificationsRead.mockResolvedValue({})
    mocks.useGetNotificationsQuery.mockReturnValue({
      isLoading: false,
      data: {
        data: [
          {
            _id: 'notification-123',
            type: 'receipt_scan.completed',
            title: 'Receipt scan completed',
            description: 'Receipt scan data is ready to review',
            severity: 'success',
            unread: true,
            actionUrl: '/transactions?highlight=tx-123',
            createdAt: new Date().toISOString(),
            readAt: null
          }
        ],
        meta: {
          unreadCount: 1
        }
      }
    })
  })

  it('renders API notifications instead of placeholder data', () => {
    render(<NotificationNav />)

    openNotifications()

    expect(screen.getByText('Receipt scan completed')).toBeInTheDocument()
    expect(
      screen.queryByText('Budget threshold reached')
    ).not.toBeInTheDocument()
  })

  it('marks unread notification as read and navigates to action url on click', async () => {
    render(<NotificationNav />)

    openNotifications()
    fireEvent.click(screen.getByText('Receipt scan completed'))

    await waitFor(() => {
      expect(mocks.markNotificationRead).toHaveBeenCalledWith(
        'notification-123'
      )
    })
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/transactions?highlight=tx-123'
    )
  })

  it('marks all notifications as read without opening any action url', async () => {
    render(<NotificationNav />)

    openNotifications()
    fireEvent.click(screen.getByLabelText('Mark all notifications as read'))

    await waitFor(() => {
      expect(mocks.markAllNotificationsRead).toHaveBeenCalled()
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})

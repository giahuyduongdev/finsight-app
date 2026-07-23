import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppSockets } from './use-app-sockets'
import { markNotificationHandledInForeground } from '@/features/notification/notificationPresentation'

type SocketHandler = (payload?: unknown) => void

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  invalidateTags: vi.fn((tags: string[]) => ({
    payload: tags,
    type: 'api/invalidateTags'
  })),
  resetApiState: vi.fn(() => ({
    type: 'api/resetApiState'
  })),
  updateNotificationQueryData: vi.fn(
    (_endpoint: string, _arg: undefined, updater: (draft: unknown) => void) => {
      const action = {
        payload: {
          data: [],
          meta: { unreadCount: 0 }
        },
        type: 'api/updateQueryData'
      }
      updater(action.payload)
      return action
    }
  ),
  upsertNotification: vi.fn(
    (notifications: unknown[], notification: unknown) => [
      notification,
      ...notifications
    ]
  ),
  logout: vi.fn(() => ({
    type: 'auth/logout'
  })),
  updateCredentials: vi.fn((payload: unknown) => ({
    payload,
    type: 'auth/updateCredentials'
  })),
  getCurrentUserInitiate: vi.fn(),
  redirectTo: vi.fn(),
  saveFlashMessage: vi.fn(),
  subscribeToLocalLogout: vi.fn(),
  unsubscribeLocalLogout: vi.fn(),
  localLogoutHandler: undefined as undefined | (() => void),
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  },
  handlers: {} as Record<string, SocketHandler>,
  socket: {
    on: vi.fn(),
    off: vi.fn()
  }
}))

vi.mock('react-redux', () => ({
  useDispatch: () => mocks.dispatch
}))

vi.mock('./use-socket', () => ({
  useSocket: () => mocks.socket
}))

vi.mock('sonner', () => ({
  toast: mocks.toast
}))

vi.mock('@/app/api-client', () => ({
  apiClient: {
    util: {
      invalidateTags: mocks.invalidateTags,
      resetApiState: mocks.resetApiState
    }
  }
}))

vi.mock('@/features/auth/authSlice', () => ({
  logout: mocks.logout,
  updateCredentials: mocks.updateCredentials
}))

vi.mock('@/lib/navigation', () => ({
  redirectTo: mocks.redirectTo
}))

vi.mock('@/lib/flash-message', () => ({
  saveFlashMessage: mocks.saveFlashMessage
}))

vi.mock('@/lib/local-logout-sync', () => ({
  subscribeToLocalLogout: mocks.subscribeToLocalLogout
}))

vi.mock('@/features/user/userAPI', () => ({
  userApi: {
    endpoints: {
      getCurrentUser: {
        initiate: mocks.getCurrentUserInitiate
      }
    }
  }
}))

vi.mock('@/features/notification/notificationAPI', () => ({
  notificationApi: {
    util: {
      updateQueryData: mocks.updateNotificationQueryData
    }
  },
  upsertNotification: mocks.upsertNotification
}))

const HookHost = () => {
  useAppSockets()
  return null
}

describe('useAppSockets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handlers = {}
    mocks.localLogoutHandler = undefined
    mocks.socket.on.mockImplementation(
      (event: string, handler: SocketHandler) => {
        mocks.handlers[event] = handler
        return mocks.socket
      }
    )
    mocks.socket.off.mockImplementation(() => mocks.socket)
    mocks.subscribeToLocalLogout.mockImplementation((handler: () => void) => {
      mocks.localLogoutHandler = handler
      return mocks.unsubscribeLocalLogout
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invalidates report cache and does not toast for API report list updates', () => {
    render(<HookHost />)

    mocks.handlers['report:list-updated']?.({
      source: 'api',
      status: 'SENT'
    })

    expect(mocks.invalidateTags).toHaveBeenCalledWith(['report'])
    expect(mocks.dispatch).toHaveBeenCalledWith({
      payload: ['report'],
      type: 'api/invalidateTags'
    })
    expect(mocks.toast.success).not.toHaveBeenCalled()
    expect(mocks.toast.error).not.toHaveBeenCalled()
    expect(mocks.toast.info).not.toHaveBeenCalled()
  })

  it.each([
    ['SENT', 'success', 'Monthly report generated'],
    ['FAILED', 'error', 'Monthly report failed'],
    ['NO_ACTIVITY', 'info', 'No activity found for this report period']
  ] as const)(
    'invalidates report cache and shows %s worker toast',
    (status, toastMethod, message) => {
      render(<HookHost />)

      mocks.handlers['report:list-updated']?.({
        source: 'worker',
        status
      })

      expect(mocks.invalidateTags).toHaveBeenCalledWith(['report'])
      expect(mocks.dispatch).toHaveBeenCalledWith({
        payload: ['report'],
        type: 'api/invalidateTags'
      })
      expect(mocks.toast[toastMethod]).toHaveBeenCalledWith(message)
    }
  )

  it('updates report settings in redux and invalidates report cache', () => {
    render(<HookHost />)

    const reportSetting = {
      _id: 'setting-123',
      frequency: 'MONTHLY',
      isEnabled: true,
      userId: 'user-123'
    }

    mocks.handlers['report:settings-updated']?.({ reportSetting })

    expect(mocks.updateCredentials).toHaveBeenCalledWith({ reportSetting })
    expect(mocks.dispatch).toHaveBeenCalledWith({
      payload: { reportSetting },
      type: 'auth/updateCredentials'
    })
    expect(mocks.invalidateTags).toHaveBeenCalledWith(['report'])
  })

  it('upserts realtime notifications and invalidates notification cache', () => {
    render(<HookHost />)

    const notification = {
      _id: 'notification-123',
      type: 'receipt_scan.completed',
      title: 'Receipt scan completed',
      description: 'Receipt scan data is ready to review',
      severity: 'success',
      unread: true,
      actionUrl: '/transactions',
      createdAt: '2026-07-08T00:00:00.000Z'
    }

    mocks.handlers['notification:created']?.(notification)

    expect(mocks.updateNotificationQueryData).toHaveBeenCalledWith(
      'getNotifications',
      undefined,
      expect.any(Function)
    )
    expect(mocks.upsertNotification).toHaveBeenCalledWith([], notification)
    expect(mocks.invalidateTags).toHaveBeenCalledWith(['notifications'])
    expect(mocks.dispatch).toHaveBeenCalledWith({
      payload: ['notifications'],
      type: 'api/invalidateTags'
    })
    expect(mocks.toast.success).toHaveBeenCalledWith('Receipt scan completed', {
      action: {
        label: 'Review receipt',
        onClick: expect.any(Function)
      },
      description: 'Receipt scan data is ready to review',
      duration: Infinity,
      id: 'notification-notification-123',
      position: 'bottom-right'
    })

    const toastOptions = mocks.toast.success.mock.calls[0]?.[1]
    toastOptions.action.onClick()
    expect(mocks.redirectTo).toHaveBeenCalledWith('/transactions')
  })

  it('does not show a background toast when this tab handled the result in the foreground', () => {
    render(<HookHost />)
    markNotificationHandledInForeground('receipt-job-123')

    mocks.handlers['notification:created']?.({
      _id: 'notification-foreground-receipt',
      type: 'receipt_scan.completed',
      title: 'Receipt scan completed',
      description: 'Receipt scan data is ready to review',
      severity: 'success',
      unread: true,
      metadata: {
        entityType: 'receipt',
        entityId: 'receipt-job-123'
      },
      createdAt: '2026-07-08T00:00:00.000Z'
    })

    expect(mocks.updateNotificationQueryData).toHaveBeenCalled()
    expect(mocks.toast.success).not.toHaveBeenCalled()
  })

  it('dismisses bulk import progress and refreshes data without showing a duplicate completion toast', () => {
    render(<HookHost />)

    mocks.handlers['bulk-import:completed']?.({
      totalInserted: 300,
      rejectedCount: 0,
      totalProcessed: 300,
      message: 'Successfully imported 300 transactions'
    })

    expect(mocks.toast.dismiss).toHaveBeenCalledWith('bulk-import')
    expect(mocks.invalidateTags).toHaveBeenCalledWith([
      'transactions',
      'analytics'
    ])
    expect(mocks.dispatch).toHaveBeenCalledWith({
      payload: ['transactions', 'analytics'],
      type: 'api/invalidateTags'
    })
    expect(mocks.toast.success).not.toHaveBeenCalledWith(
      'Successfully imported 300 transactions',
      expect.anything()
    )
  })

  it('dismisses bulk import progress without showing a duplicate failure toast', () => {
    render(<HookHost />)

    mocks.handlers['bulk-import:failed']?.({
      message: 'Import failed, please try again'
    })

    expect(mocks.toast.dismiss).toHaveBeenCalledWith('bulk-import')
    expect(mocks.toast.error).not.toHaveBeenCalledWith(
      'Import failed, please try again',
      expect.anything()
    )
  })

  it('stores a flash message, clears auth data, and redirects on auth session revoked', () => {
    render(<HookHost />)

    mocks.handlers['auth:session-revoked']?.({
      message: 'Your sessions were ended. Please sign in again',
      redirectTo: '/'
    })

    expect(mocks.saveFlashMessage).toHaveBeenCalledWith({
      message: 'Your sessions were ended. Please sign in again',
      type: 'info'
    })
    expect(mocks.logout).toHaveBeenCalled()
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'auth/logout' })
    expect(mocks.resetApiState).toHaveBeenCalled()
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'api/resetApiState' })
    expect(mocks.redirectTo).toHaveBeenCalledWith('/')
  })

  it('handles duplicate auth session revoked events once', () => {
    render(<HookHost />)

    mocks.handlers['auth:session-revoked']?.({
      message: 'Your password changed. Please sign in again'
    })
    mocks.handlers['auth:session-revoked']?.({
      message: 'Your password changed. Please sign in again'
    })

    expect(mocks.logout).toHaveBeenCalledTimes(1)
    expect(mocks.resetApiState).toHaveBeenCalledTimes(1)
    expect(mocks.redirectTo).toHaveBeenCalledTimes(1)
  })

  it('stores completed auth security changes as success flash messages', () => {
    render(<HookHost />)

    mocks.handlers['auth:session-revoked']?.({
      reason: 'password-changed',
      message: 'Your password changed. Please sign in again'
    })

    expect(mocks.saveFlashMessage).toHaveBeenCalledWith({
      message: 'Your password changed. Please sign in again',
      type: 'success'
    })
  })

  it('stores a flash message, clears auth data, and redirects on local logout', () => {
    render(<HookHost />)

    mocks.localLogoutHandler?.()

    expect(mocks.saveFlashMessage).toHaveBeenCalledWith({
      message: 'Logged out successfully',
      type: 'info'
    })
    expect(mocks.logout).toHaveBeenCalled()
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'auth/logout' })
    expect(mocks.resetApiState).toHaveBeenCalled()
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'api/resetApiState' })
    expect(mocks.redirectTo).toHaveBeenCalledWith('/')
  })

  it('removes report socket listeners on unmount', () => {
    const { unmount } = render(<HookHost />)

    unmount()

    expect(mocks.socket.off).toHaveBeenCalledWith(
      'report:list-updated',
      expect.any(Function)
    )
    expect(mocks.socket.off).toHaveBeenCalledWith(
      'report:settings-updated',
      expect.any(Function)
    )
    expect(mocks.socket.off).toHaveBeenCalledWith(
      'auth:session-revoked',
      expect.any(Function)
    )
    expect(mocks.socket.off).toHaveBeenCalledWith(
      'notification:created',
      expect.any(Function)
    )
    expect(mocks.unsubscribeLocalLogout).toHaveBeenCalled()
  })
})

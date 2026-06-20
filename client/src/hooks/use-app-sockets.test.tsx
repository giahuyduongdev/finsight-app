import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppSockets } from './use-app-sockets'

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
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    success: vi.fn()
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
    expect(mocks.unsubscribeLocalLogout).toHaveBeenCalled()
  })
})

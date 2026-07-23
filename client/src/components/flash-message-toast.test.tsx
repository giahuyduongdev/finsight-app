import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FlashMessageToast } from './flash-message-toast'
import { APP_NAVIGATION_EVENT } from '@/lib/navigation'

const mocks = vi.hoisted(() => ({
  consumeFlashMessage: vi.fn(),
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  }
}))

vi.mock('@/lib/flash-message', () => ({
  consumeFlashMessage: mocks.consumeFlashMessage
}))

vi.mock('sonner', () => ({
  toast: mocks.toast
}))

describe('FlashMessageToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the stored message after the toaster has mounted', () => {
    mocks.consumeFlashMessage.mockReturnValue({
      message: 'Please sign in again',
      type: 'info'
    })

    render(<FlashMessageToast />)

    expect(mocks.consumeFlashMessage).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(mocks.consumeFlashMessage).toHaveBeenCalledTimes(1)
    expect(mocks.toast.info).toHaveBeenCalledWith('Please sign in again', {
      duration: 4000
    })
  })

  it('shows a stored message after internal navigation', () => {
    mocks.consumeFlashMessage.mockReturnValueOnce(null).mockReturnValueOnce({
      message: 'Password changed successfully. Please sign in again',
      type: 'success'
    })

    render(<FlashMessageToast />)
    vi.runOnlyPendingTimers()

    window.dispatchEvent(new CustomEvent(APP_NAVIGATION_EVENT))
    vi.runOnlyPendingTimers()

    expect(mocks.toast.success).toHaveBeenCalledWith(
      'Password changed successfully. Please sign in again',
      { duration: 4000 }
    )
  })
})

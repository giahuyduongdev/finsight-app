import { describe, expect, it, vi } from 'vitest'
import { APP_NAVIGATION_EVENT, redirectTo } from './navigation'

describe('redirectTo', () => {
  it('dispatches app navigation for same-origin URLs', () => {
    const listener = vi.fn()
    window.addEventListener(APP_NAVIGATION_EVENT, listener)

    try {
      redirectTo('/rates?from=toast')

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { to: '/rates?from=toast' }
        })
      )
    } finally {
      window.removeEventListener(APP_NAVIGATION_EVENT, listener)
    }
  })
})

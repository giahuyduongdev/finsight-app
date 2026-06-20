import { beforeEach, describe, expect, it } from 'vitest'
import { consumeFlashMessage, saveFlashMessage } from './flash-message'

describe('flash message', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('stores and consumes a flash message once', () => {
    saveFlashMessage({
      message: 'Please sign in again',
      type: 'info'
    })

    expect(consumeFlashMessage()).toEqual({
      message: 'Please sign in again',
      type: 'info'
    })
    expect(consumeFlashMessage()).toBeNull()
  })

  it('discards an invalid stored value', () => {
    sessionStorage.setItem('auth:flash-message', 'invalid-json')

    expect(consumeFlashMessage()).toBeNull()
    expect(sessionStorage.getItem('auth:flash-message')).toBeNull()
  })
})

export type FlashMessageType = 'success' | 'info' | 'error'

export interface FlashMessage {
  message: string
  type: FlashMessageType
}

const FLASH_MESSAGE_KEY = 'auth:flash-message'

export const saveFlashMessage = (flashMessage: FlashMessage) => {
  sessionStorage.setItem(FLASH_MESSAGE_KEY, JSON.stringify(flashMessage))
}

export const consumeFlashMessage = (): FlashMessage | null => {
  const storedMessage = sessionStorage.getItem(FLASH_MESSAGE_KEY)
  if (!storedMessage) return null

  sessionStorage.removeItem(FLASH_MESSAGE_KEY)

  try {
    return JSON.parse(storedMessage) as FlashMessage
  } catch {
    return null
  }
}

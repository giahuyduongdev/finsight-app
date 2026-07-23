import { useEffect } from 'react'
import { toast } from 'sonner'
import { consumeFlashMessage } from '@/lib/flash-message'
import { APP_NAVIGATION_EVENT } from '@/lib/navigation'

export const FlashMessageToast = () => {
  useEffect(() => {
    const showFlashMessage = () => {
      const flashMessage = consumeFlashMessage()
      if (!flashMessage) return

      toast[flashMessage.type](flashMessage.message, { duration: 4000 })
    }

    const scheduleFlashMessage = () => window.setTimeout(showFlashMessage, 0)
    const timeoutId = scheduleFlashMessage()
    const handleNavigation = () => {
      scheduleFlashMessage()
    }

    window.addEventListener(APP_NAVIGATION_EVENT, handleNavigation)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener(APP_NAVIGATION_EVENT, handleNavigation)
    }
  }, [])

  return null
}

import { useEffect } from 'react'
import { toast } from 'sonner'
import { consumeFlashMessage } from '@/lib/flash-message'

export const FlashMessageToast = () => {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const flashMessage = consumeFlashMessage()
      if (!flashMessage) return

      toast[flashMessage.type](flashMessage.message, { duration: 4000 })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  return null
}

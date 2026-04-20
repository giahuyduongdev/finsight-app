import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useSocket } from './use-socket'
import { apiClient } from '@/app/api-client'
import { useAppDispatch } from '@/app/hook'

export const useRecurringTransactionSocket = () => {
  const socket = useSocket()
  const dispatch = useAppDispatch()

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!socket) return

    socket.on('recurring-transaction:processed', (data) => {
      // 1. Chỉ hiện 1 Toast duy nhất, không bắn 1000 cái gây lag
      toast.success(data.message || 'Processing recurring transactions...', {
        id: 'recurring-update', // ID cố định để đè lên nhau
        duration: 3000
      })

      // 2. Debounce việc làm mới dữ liệu: Chỉ load lại 1 lần sau khi hết chuỗi sự kiện
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        console.log('🔄 Data invalidated after recurring batch completion')
        dispatch(apiClient.util.invalidateTags(['transactions', 'analytics']))
      }, 1000) // Đợi 1 giây yên tĩnh rồi mới load lại
    })

    return () => {
      socket.off('recurring-transaction:processed')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [socket, dispatch])
}

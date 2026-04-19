import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSelector } from 'react-redux'
import type { RootState } from '@/app/store'

let socketInstance: Socket | null = null

export const useSocket = () => {
  const accessToken = useSelector((state: RootState) => state.auth.accessToken)
  const [socket, setSocket] = useState<Socket | null>(socketInstance)

  useEffect(() => {
    if (!accessToken) {
      if (socketInstance) {
        socketInstance.disconnect()
        socketInstance = null
        setSocket(null)
      }
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
    const socketUrl = apiUrl.replace('/api', '')

    if (!socketInstance) {
      socketInstance = io(socketUrl, {
        withCredentials: true,
        auth: { token: accessToken }
      })

      socketInstance.on('connect', () => {
        console.log('🔌 Socket connected')
      })

      socketInstance.on('connect_error', (err) => {
        console.error('❌ Socket error:', err.message)
        if (err.message.includes('UNAUTHORIZED')) {
          socketInstance?.disconnect()
          socketInstance = null
          setSocket(null)
        }
      })
    }

    setSocket(socketInstance)
  }, [accessToken])

  return socket
}

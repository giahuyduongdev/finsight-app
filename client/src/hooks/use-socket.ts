import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '@/app/store'
import { useRefreshMutation } from '@/features/auth/authAPI'
import { updateCredentials, logout } from '@/features/auth/authSlice'

let socketInstance: Socket | null = null
let isRefreshing = false // Tránh loop nếu refresh thất bại liên tục

export const useSocket = () => {
  const accessToken = useSelector((state: RootState) => state.auth.accessToken)
  const dispatch = useDispatch<AppDispatch>()
  const [refresh] = useRefreshMutation()
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
    // Use URL API for robust URL manipulation
    const url = new URL(apiUrl)
    const socketUrl = `${url.protocol}//${url.host}`

    // Token changed on an existing socket → update auth and reconnect
    if (socketInstance) {
      console.log('🔄 Updating socket auth token')
      socketInstance.off('connect')
      socketInstance.off('connect_error')
      socketInstance.off('disconnect')
      socketInstance.disconnect()
      socketInstance.auth = { token: accessToken }
      socketInstance.connect()
      setSocket(socketInstance)
      return
    }

    if (!socketInstance) {
      socketInstance = io(socketUrl, {
        withCredentials: true,
        auth: { token: accessToken },
        reconnection: true,
        reconnectionAttempts: 5
      })

      socketInstance.on('connect', () => {
        console.log('🔌 Socket connected')
        isRefreshing = false // Reset sau khi connect thành công
      })

      socketInstance.on('connect_error', async (err) => {
        console.error('❌ Socket error:', err.message)

        if (err.message.includes('UNAUTHORIZED') && !isRefreshing) {
          console.warn('🔑 Socket unauthorized. Attempting token refresh...')
          isRefreshing = true

          // Disable reconnection during refresh to prevent race condition
          if (socketInstance) {
            socketInstance.io.opts.reconnection = false
          }

          try {
            const result = await refresh({}).unwrap()
            dispatch(
              updateCredentials({
                accessToken: result.accessToken,
                expiresAt: result.expiresAt
              })
            )
            // Re-enable reconnection after successful refresh
            if (socketInstance) {
              socketInstance.io.opts.reconnection = true
            }
            // useEffect sẽ tự chạy lại và cập nhật token ở block "socketInstance" phía trên
          } catch (refreshErr) {
            console.error('❌ Token refresh failed for socket:', refreshErr)
            dispatch(logout())
            socketInstance?.disconnect()
            socketInstance = null
            setSocket(null)
          } finally {
            isRefreshing = false
          }
        }
      })

      socketInstance.on('disconnect', () => {
        console.log('🔌 Socket disconnected')
      })
    }

    setSocket(socketInstance)

    // Cleanup function to remove listeners
    return () => {
      if (socketInstance) {
        socketInstance.off('connect')
        socketInstance.off('connect_error')
        socketInstance.off('disconnect')
      }
    }
  }, [accessToken, dispatch, refresh])

  return socket
}

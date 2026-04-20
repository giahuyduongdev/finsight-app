import { io, Socket } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

let socket: Socket | null = null

export const getSocket = (token?: string): Socket => {
  if (!socket && token) {
    socket = io(BACKEND_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      console.log('🔌 [Socket] Connected to backend')
    })

    socket.on('connect_error', (error) => {
      console.error('❌ [Socket] Connection error:', error.message)
    })
  }

  return socket as Socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

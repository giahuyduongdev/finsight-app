import { Server } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Env } from './env.config'
import { logger } from './logger.config'

let io: Server

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: Env.FRONTEND_ORIGIN,
      credentials: true
    }
  })

  // ─── Middleware xác thực JWT ──────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error('UNAUTHORIZED: No token provided'))
      }

      const decoded = jwt.verify(token, Env.JWT_SECRET, {
        audience: ['user'] // khớp với defaults trong jwt.util.ts
      }) as JwtPayload & { userId: string } //đúng với AccessTokenPayload

      if (!decoded.userId) {
        return next(new Error('UNAUTHORIZED: Invalid token payload'))
      }

      socket.data.userId = decoded.userId // dùng userId không phải id
      next()
    } catch (error) {
      logger.error('❌ [Socket] Auth error:', (error as Error).message)
      next(new Error('UNAUTHORIZED: Token verification failed'))
    }
  })

  // ─── Connection ───────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.data.userId
    logger.info(`🔌 [Socket] User ${userId} connected: ${socket.id}`)

    socket.join(userId) // tự join room, FE không cần gửi userId
    logger.info(`👥 [Socket] User ${userId} joined room: ${userId}`)

    socket.on('disconnect', () => {
      logger.info(`🔌 [Socket] User ${userId} disconnected: ${socket.id}`)
    })
  })

  logger.info('🚀 [Socket] Initialized')
  return io
}

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}

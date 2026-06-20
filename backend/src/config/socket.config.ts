import { Server } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { verifyAccessToken } from '../utils/jwt.util'
import { Env } from './env.config'
import { logger } from './logger.config'
import { authenticateAccessToken } from '../services/access-token-auth.service'

let io: Server

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: Env.FRONTEND_ORIGIN,
      credentials: true
    }
  })

  // ─── Middleware xác thực JWT ──────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token

      // Explicitly check for empty or missing token
      if (!token || (typeof token === 'string' && token.trim() === '')) {
        return next(new Error('UNAUTHORIZED: No token provided'))
      }

      const decoded = verifyAccessToken(token)
      const user = await authenticateAccessToken(decoded)
      if (!user) {
        return next(new Error('UNAUTHORIZED: Invalid or revoked token'))
      }

      socket.data.userId = decoded.userId
      next()
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('[SYS:Socket] Auth error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      })

      // Gửi về mã lỗi cụ thể để FE biết đường làm mới Token
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        return next(new Error('UNAUTHORIZED: Token expired'))
      }

      next(new Error(`UNAUTHORIZED: ${errorMessage}`))
    }
  })

  // ─── Connection ───────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.data.userId
    logger.info(`[SYS:Socket] User ${userId} connected: ${socket.id}`)

    socket.join(userId) // tự join room, FE không cần gửi userId
    logger.info(`[SYS:Socket] User ${userId} joined room: ${userId}`)

    socket.on('disconnect', () => {
      logger.info(`[SYS:Socket] User ${userId} disconnected: ${socket.id}`)
    })
  })

  logger.info('[SYS:Socket] Initialized')
  return io
}

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}

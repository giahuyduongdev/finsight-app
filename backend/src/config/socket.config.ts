import { Server } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Env } from './env.config'
import { logger } from './logger.config'
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

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

      // Explicitly check for empty or missing token
      if (!token || (typeof token === 'string' && token.trim() === '')) {
        return next(new Error('UNAUTHORIZED: No token provided'))
      }

      const decoded = jwt.verify(token, Env.JWT_SECRET, {
        audience: ['user']
      }) as JwtPayload & { userId: string }

      if (!decoded.userId) {
        return next(new Error('UNAUTHORIZED: Invalid token payload'))
      }

      socket.data.userId = decoded.userId
      next()
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error(
        logIcon(LOG_ICONS.ERROR, `[Socket] Auth error: ${errorMessage}`)
      )

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
    logger.info(
      logIcon(
        LOG_ICONS.SOCKET,
        `[Socket] User ${userId} connected: ${socket.id}`
      )
    )

    socket.join(userId) // tự join room, FE không cần gửi userId
    logger.info(
      logIcon(LOG_ICONS.INFO, ` [Socket] User ${userId} joined room: ${userId}`)
    )

    socket.on('disconnect', () => {
      logger.info(
        logIcon(
          LOG_ICONS.SOCKET,
          `[Socket] User ${userId} disconnected: ${socket.id}`
        )
      )
    })
  })

  logger.info(logIcon(LOG_ICONS.SUCCESS, ' [Socket] Initialized'))
  return io
}

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}

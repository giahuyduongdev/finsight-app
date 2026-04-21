import mongoose from 'mongoose'
import readline from 'readline'
import http from 'http'
import app from './src/app'
import { Env } from './src/config/env.config'
import connectDB from './src/config/database.config'
import { initializeCrons, stopCrons } from './src/cron'
import {
  checkOverload,
  stopOverload
} from './src/helpers/check-db-connect.helper'
import { redis } from './src/config/redis.config'
import { logger } from './src/config/logger.config'
import { initializeWorkers, stopWorkers } from './src/workers'
import { closeQueues } from './src/queues'
import { initializeSocket, getIO } from './src/config/socket.config' 
import { CurrencyService } from './src/services/currency.service'

// ─── Constants ────────────────────────────────────────────────────────────────

const SHUTDOWN_TIMEOUT_MS = 10_000

// ─── Global error handlers ────────────────────────────────────────────────────

process.on('uncaughtException', (err: Error) => {
  logger.error('❌ Uncaught Exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('❌ Unhandled Rejection:', reason)
  process.exit(1)
})

// ─── Windows SIGINT fix ───────────────────────────────────────────────────────

if (process.platform === 'win32') {
  readline
    .createInterface({ input: process.stdin, output: process.stdout })
    .on('SIGINT', () => process.emit('SIGINT'))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const closeGracefully = (
  label: string,
  fn: () => Promise<unknown>
): Promise<void> =>
  fn()
    .then(() => {
      logger.info(`✅ ${label} closed`)
    })
    .catch((err) => {
      logger.error(`❌ ${label} error:`, err)
    })

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const startServer = async (): Promise<void> => {
  await connectDB()
  
  const server = http.createServer(app)

  initializeSocket(server)

  // Lấy tỉ giá ngay khi khởi động để Redis không bị trống
  // Phải gọi SAU KHI initializeSocket vì hàm này broadcast qua socket
  try {
    await CurrencyService.fetchAndBroadcastRates()
  } catch (error) {
    logger.error('❌ Failed to fetch initial rates:', error)
  }

  if (Env.NODE_ENV === 'development') {
    checkOverload()
  }

  await initializeCrons()
  initializeWorkers()

  server.listen(Env.PORT, () => {
    logger.info(`🖥️  [Server] running on port ${Env.PORT} [${Env.NODE_ENV}]`)
  })

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────

  let isShuttingDown = false

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return
    isShuttingDown = true

    logger.info(`\n⚠️  ${signal} received. Starting graceful shutdown...`)

    const forceExitTimer = setTimeout(() => {
      logger.error('❌ Shutdown timed out. Forcing exit.')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    forceExitTimer.unref()

    try {
      stopCrons()
      stopOverload()

      server.closeIdleConnections?.()
      server.closeAllConnections()

      await Promise.all([
        closeGracefully(
          'HTTP server',
          () =>
            new Promise<void>((resolve, reject) =>
              server.close((err) => (err ? reject(err) : resolve()))
            )
        ),

        mongoose.connection.readyState !== 0
          ? closeGracefully('MongoDB', () => mongoose.connection.close())
          : Promise.resolve(),

        redis
          ? closeGracefully('Redis', () => redis.quit())
          : Promise.resolve(),

        closeGracefully('Workers', () => stopWorkers()),
        closeGracefully('Queues', () => closeQueues()),

        closeGracefully(
          'Socket',
          () => new Promise<void>((resolve) => getIO().close(() => resolve()))
        )
      ])

      clearTimeout(forceExitTimer)
      logger.info('👋 Shutdown complete. Goodbye!')
      process.exit(0)
    } catch (err) {
      logger.error('❌ Shutdown error:', err)
      process.exit(1)
    }
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

// ─── Start ────────────────────────────────────────────────────────────────────

startServer().catch((err) => {
  logger.error('❌ Failed to start server:', err)
  process.exit(1)
})

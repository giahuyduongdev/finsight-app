import mongoose from 'mongoose'
import readline from 'readline'
import http from 'http'
import app from './src/app'
import { appConfig, isDevelopment } from './src/config/app.config'
import { initializeDatabases } from './src/databases'
import { initializeCrons, stopCrons } from './src/cron'
import {
  checkOverload,
  stopOverload
} from './src/helpers/check-db-connect.helper'
import { redis } from './src/databases/redis.database'
import { logger } from './src/config/logger.config'
import { initializeWorkers, stopWorkers } from './src/workers'
import { closeQueues } from './src/queues'
import { initializeSocket, getIO } from './src/config/socket.config'
import { CurrencyService } from './src/services/currency.service'

// ─── Global error handlers ────────────────────────────────────────────────────

process.on('uncaughtException', (err: Error) => {
  logger.error('[APP:Server] Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('[APP:Server] Unhandled Rejection:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  })
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
      logger.info(`[APP:Server] ${label} closed`)
    })
    .catch((err) => {
      logger.error(`[APP:Server] ${label} error:`, err)
    })

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const startServer = async (): Promise<void> => {
  await initializeDatabases()

  const server = http.createServer(app)

  initializeSocket(server)

  // Lấy tỉ giá ngay khi khởi động để Redis không bị trống
  // Phải gọi SAU KHI initializeSocket vì hàm này broadcast qua socket
  try {
    await CurrencyService.fetchAndBroadcastRates()
  } catch (error) {
    logger.error('[APP:Server] Failed to fetch initial rates:', error)
  }

  if (isDevelopment()) {
    checkOverload()
  }

  await initializeCrons()
  initializeWorkers()

  server.listen(appConfig.port, () => {
    logger.info(
      `[APP:Server] Server running on port ${appConfig.port} [${appConfig.nodeEnv}]`
    )
  })

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────

  let isShuttingDown = false

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return
    isShuttingDown = true

    logger.info(
      `[APP:Server] ${signal} received. Starting graceful shutdown...`
    )

    const forceExitTimer = setTimeout(() => {
      logger.error('[APP:Server] Shutdown timed out. Forcing exit.')
      process.exit(1)
    }, appConfig.timeouts.shutdown)
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
      logger.info('[APP:Server] Shutdown complete. Goodbye!')
      process.exit(0)
    } catch (err) {
      logger.error('[APP:Server] Shutdown error:', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      process.exit(1)
    }
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

// ─── Start ────────────────────────────────────────────────────────────────────

startServer().catch((err) => {
  logger.error('[APP:Server] Failed to start server:', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  })
  process.exit(1)
})

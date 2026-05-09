import mongoose from 'mongoose'
import { Env } from '../config/env.config'
import { logger } from './logger.config'

class Database {
  private static instance: Database

  private constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      logger.info('[SYS:MongoDB] Connected successfully!')
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('[SYS:MongoDB] Connection lost! Waiting to reconnect...')
    })

    mongoose.connection.on('reconnected', () => {
      logger.info('[SYS:MongoDB] Reconnected successfully!')
    })

    mongoose.connection.on('error', (err: Error) => {
      logger.error('[SYS:MongoDB] Connection error:', {
        error: err.message,
        stack: err.stack
      })
    })
  }

  private async connect(): Promise<void> {
    try {
      // if (Env.NODE_ENV === 'development') {
      //   mongoose.set('debug', true)
      //   mongoose.set('debug', { color: true })
      // }

      // Validate and parse MongoDB config values with fallbacks
      const maxPoolSize = Number(Env.MONGO_MAX_POOL_SIZE) || 10
      const serverSelectionTimeout =
        Number(Env.MONGO_SERVER_SELECTION_TIMEOUT) || 5000
      const socketTimeout = Number(Env.MONGO_SOCKET_TIMEOUT) || 45000
      const connectTimeout = Number(Env.MONGO_CONNECT_TIMEOUT) || 10000

      await mongoose.connect(Env.MONGO_URI, {
        maxPoolSize,
        serverSelectionTimeoutMS: serverSelectionTimeout,
        socketTimeoutMS: socketTimeout,
        connectTimeoutMS: connectTimeout
      })
    } catch (error) {
      logger.error('[SYS:MongoDB] Error connecting to MongoDB:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      process.exit(1)
    }
  }

  static async getInstance(): Promise<void> {
    if (!Database.instance) {
      Database.instance = new Database()
      await Database.instance.connect()
    }
  }
}

export default Database.getInstance

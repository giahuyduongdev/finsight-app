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
      logger.info(`🟢 [MongoDB] Connected successfully!`)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('🔴 [MongoDB] Connection lost! Waiting to reconnect...')
    })

    mongoose.connection.on('reconnected', () => {
      logger.info('🟡 [MongoDB] Reconnected successfully!')
    })

    mongoose.connection.on('error', (err: Error) => {
      logger.error('❌ [MongoDB] Connection error:', err.message)
    })
  }

  private async connect(): Promise<void> {
    try {
      // if (Env.NODE_ENV === 'development') {
      //   mongoose.set('debug', true)
      //   mongoose.set('debug', { color: true })
      // }

      await mongoose.connect(Env.MONGO_URI, {
        maxPoolSize: Number(Env.MONGO_MAX_POOL_SIZE),
        serverSelectionTimeoutMS: Number(Env.MONGO_SERVER_SELECTION_TIMEOUT),
        socketTimeoutMS: Number(Env.MONGO_SOCKET_TIMEOUT),
        connectTimeoutMS: Number(Env.MONGO_CONNECT_TIMEOUT)
      })
    } catch (error) {
      logger.error('Error connecting to MongoDB: ', error)
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

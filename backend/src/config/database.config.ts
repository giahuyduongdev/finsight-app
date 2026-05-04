import mongoose from 'mongoose'
import { Env } from '../config/env.config'
import { logger } from './logger.config'
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

class Database {
  private static instance: Database

  private constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      logger.info(
        logIcon(LOG_ICONS.SUCCESS, '[MongoDB] Connected successfully!')
      )
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn(
        logIcon(
          LOG_ICONS.STOP,
          '[MongoDB] Connection lost! Waiting to reconnect...'
        )
      )
    })

    mongoose.connection.on('reconnected', () => {
      logger.info(
        logIcon(LOG_ICONS.WARNING, '[MongoDB] Reconnected successfully!')
      )
    })

    mongoose.connection.on('error', (err: Error) => {
      logger.error(
        logIcon(LOG_ICONS.ERROR, '[MongoDB] Connection error:'),
        err.message
      )
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

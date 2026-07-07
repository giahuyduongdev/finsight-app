/**
 * MongoDB Database Connection
 * Handles Mongoose connection, reconnection, and event listeners
 */

import mongoose from 'mongoose'
import { mongoConfig } from '../config/db.config'
import { logger } from '../config/logger.config'
import { instrumentMongoDBPoolMetrics } from '../observability'

class MongoDatabase {
  private static instance: MongoDatabase

  private constructor() {
    this.setupEventListeners()
  }

  /**
   * Setup MongoDB connection event listeners
   */
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

  /**
   * Connect to MongoDB
   */
  private async connect(): Promise<void> {
    try {
      await mongoose.connect(mongoConfig.uri, mongoConfig.options)
      instrumentMongoDBPoolMetrics(mongoose.connection)
    } catch (error) {
      logger.error('[SYS:MongoDB] Error connecting to MongoDB:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      process.exit(1)
    }
  }

  /**
   * Get MongoDB instance (Singleton)
   * Uses a connection promise to prevent race conditions
   */
  private static connectionPromise: Promise<void> | null = null

  static async getInstance(): Promise<void> {
    if (!MongoDatabase.instance) {
      if (!MongoDatabase.connectionPromise) {
        MongoDatabase.connectionPromise = (async () => {
          MongoDatabase.instance = new MongoDatabase()
          await MongoDatabase.instance.connect()
        })()
      }
      await MongoDatabase.connectionPromise
    }
  }

  /**
   * Disconnect from MongoDB
   */
  static async disconnect(): Promise<void> {
    await mongoose.disconnect()
    logger.info('[SYS:MongoDB] Disconnected')
  }
}

export default MongoDatabase.getInstance
export { MongoDatabase }

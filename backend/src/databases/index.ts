/**
 * Database Initialization
 * Initialize all database connections (MongoDB, Redis)
 */

import connectMongoDB from './mongo.database'
import { logger } from '../config/logger.config'

/**
 * Initialize all database connections
 */
export async function initializeDatabases(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectMongoDB()

    // Redis auto-connects on initialization (lazyConnect: false)
    // No need to call redis.connect() here

    logger.info('[SYS:Database] All databases initialized successfully')
  } catch (error) {
    logger.error('[SYS:Database] Failed to initialize databases:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    process.exit(1)
  }
}

/**
 * Gracefully disconnect all databases
 */
export async function disconnectDatabases(): Promise<void> {
  try {
    const { MongoDatabase } = await import('./mongo.database')
    const { RedisDatabase } = await import('./redis.database')

    await Promise.all([MongoDatabase.disconnect(), RedisDatabase.disconnect()])

    logger.info('[SYS:Database] All databases disconnected')
  } catch (error) {
    logger.error('[SYS:Database] Error during disconnect:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

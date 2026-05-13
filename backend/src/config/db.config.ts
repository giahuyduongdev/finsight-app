/**
 * Database Configuration
 * MongoDB connection pool options and settings
 */

import { Env } from './env.config'

/**
 * MongoDB connection options
 */
export const mongoConfig = {
  uri: Env.MONGO_URI,
  options: {
    maxPoolSize: Number(Env.MONGO_MAX_POOL_SIZE) || 10,
    serverSelectionTimeoutMS:
      Number(Env.MONGO_SERVER_SELECTION_TIMEOUT) || 5000,
    socketTimeoutMS: Number(Env.MONGO_SOCKET_TIMEOUT) || 45000,
    connectTimeoutMS: Number(Env.MONGO_CONNECT_TIMEOUT) || 10000
  }
}

/**
 * Redis connection options
 */
export const redisConfig = {
  url: Env.REDIS_URL,
  options: {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    lazyConnect: true
  }
}

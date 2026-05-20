import mongoose from 'mongoose'
import { HealthStatus } from '../@types'

const withTiming = async (
  check: () => Promise<void>
): Promise<HealthStatus> => {
  const start = Date.now()

  try {
    await check()
    return { status: 'up', responseTime: Date.now() - start }
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export const checkMongoDB = async (): Promise<HealthStatus> =>
  withTiming(async () => {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB is not connected')
    }

    await mongoose.connection.db?.admin().ping()
  })

export const checkRedis = async (): Promise<HealthStatus> =>
  withTiming(async () => {
    const { redis } = await import('../databases/redis.database')
    await redis.ping()
  })

export const checkBullMQ = async (): Promise<HealthStatus> =>
  withTiming(async () => {
    const { bullMQConnection } = await import('../config/bull/bullmq.config')
    await bullMQConnection.ping()
  })

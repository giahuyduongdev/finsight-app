import mongoose from 'mongoose'
import {
  checkBullMQ,
  checkMongoDB,
  checkRedis
} from '../../utils/healthCheck.util'
import { redis } from '../../databases/redis.database'
import { bullMQConnection } from '../../config/bull/bullmq.config'

jest.mock('../../databases/redis.database', () => ({
  redis: {
    ping: jest.fn()
  }
}))

jest.mock('../../config/bull/bullmq.config', () => ({
  bullMQConnection: {
    ping: jest.fn()
  }
}))

type MockMongooseConnection = Pick<mongoose.Connection, 'readyState' | 'db'>

const createMockConnection = (
  readyState: number,
  ping?: jest.Mock
): MockMongooseConnection =>
  ({
    readyState,
    db: ping
      ? {
          admin: () => ({ ping })
        }
      : undefined
  }) as MockMongooseConnection

describe('healthCheck.util', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns MongoDB up when connection is ready and ping succeeds', async () => {
    jest
      .spyOn(mongoose, 'connection', 'get')
      .mockReturnValue(
        createMockConnection(
          1,
          jest.fn().mockResolvedValue(undefined)
        ) as mongoose.Connection
      )

    const result = await checkMongoDB()

    expect(result.status).toBe('up')
    expect(result.responseTime).toEqual(expect.any(Number))
  })

  it('returns MongoDB down when connection is not ready', async () => {
    jest
      .spyOn(mongoose, 'connection', 'get')
      .mockReturnValue(createMockConnection(0) as mongoose.Connection)

    const result = await checkMongoDB()

    expect(result.status).toBe('down')
    expect(result.error).toBe('MongoDB is not connected')
  })

  it('returns Redis up when ping succeeds', async () => {
    jest.mocked(redis.ping).mockResolvedValue('PONG')

    const result = await checkRedis()

    expect(result.status).toBe('up')
  })

  it('returns Redis down when ping fails', async () => {
    jest.mocked(redis.ping).mockRejectedValue(new Error('redis unavailable'))

    const result = await checkRedis()

    expect(result.status).toBe('down')
    expect(result.error).toBe('redis unavailable')
  })

  it('returns BullMQ up when ping succeeds', async () => {
    jest.mocked(bullMQConnection.ping).mockResolvedValue('PONG')

    const result = await checkBullMQ()

    expect(result.status).toBe('up')
  })

  it('returns BullMQ down when ping fails', async () => {
    jest
      .mocked(bullMQConnection.ping)
      .mockRejectedValue(new Error('bullmq unavailable'))

    const result = await checkBullMQ()

    expect(result.status).toBe('down')
    expect(result.error).toBe('bullmq unavailable')
  })
})

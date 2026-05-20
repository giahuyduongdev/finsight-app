import { Request, Response } from 'express'
import {
  healthCheckController,
  readinessCheckController
} from '../../controllers/health.controller'

jest.mock('../../utils/healthCheck.util', () => ({
  checkMongoDB: jest.fn(),
  checkRedis: jest.fn(),
  checkBullMQ: jest.fn()
}))

const healthChecks = jest.requireMock('../../utils/healthCheck.util') as {
  checkMongoDB: jest.Mock
  checkRedis: jest.Mock
  checkBullMQ: jest.Mock
}

const up = { status: 'up', responseTime: 1 }
const down = { status: 'down', responseTime: 1, error: 'connection failed' }

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  }
  return res as unknown as Response
}

describe('health controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    healthChecks.checkMongoDB.mockResolvedValue(up)
    healthChecks.checkRedis.mockResolvedValue(up)
    healthChecks.checkBullMQ.mockResolvedValue(up)
  })

  it('returns 200 healthy when all dependencies are up', async () => {
    const res = createResponse()

    await healthCheckController({} as Request, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        checks: {
          mongodb: up,
          redis: up,
          bullmq: up
        }
      })
    )
  })

  it('returns 503 unhealthy when MongoDB is down', async () => {
    healthChecks.checkMongoDB.mockResolvedValue(down)
    const res = createResponse()

    await healthCheckController({} as Request, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unhealthy',
        checks: expect.objectContaining({ mongodb: down })
      })
    )
  })

  it('returns 503 unhealthy when Redis is down', async () => {
    healthChecks.checkRedis.mockResolvedValue(down)
    const res = createResponse()

    await healthCheckController({} as Request, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unhealthy',
        checks: expect.objectContaining({ redis: down })
      })
    )
  })

  it('returns 503 unhealthy when BullMQ is down', async () => {
    healthChecks.checkBullMQ.mockResolvedValue(down)
    const res = createResponse()

    await healthCheckController({} as Request, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unhealthy',
        checks: expect.objectContaining({ bullmq: down })
      })
    )
  })

  it('returns readiness status', async () => {
    const res = createResponse()

    await readinessCheckController({} as Request, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ready: true,
        timestamp: expect.any(String),
        checks: {
          mongodb: up,
          redis: up,
          bullmq: up
        }
      })
    )
  })
})

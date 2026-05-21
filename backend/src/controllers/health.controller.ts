import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import {
  checkBullMQ,
  checkMongoDB,
  checkRedis
} from '../utils/healthCheck.util'
import { HealthCheckResponse, ReadinessResponse } from '../@types'

const getDependencyChecks = async (): Promise<
  HealthCheckResponse['checks']
> => {
  const [mongodb, redis, bullmq] = await Promise.all([
    checkMongoDB(),
    checkRedis(),
    checkBullMQ()
  ])

  return { mongodb, redis, bullmq }
}

export const healthCheckController = async (_req: Request, res: Response) => {
  const checks = await getDependencyChecks()
  const isHealthy = Object.values(checks).every(
    (check) => check.status === 'up'
  )
  const response: HealthCheckResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks
  }

  return res
    .status(isHealthy ? HTTPSTATUS.OK : HTTPSTATUS.SERVICE_UNAVAILABLE)
    .json(response)
}

export const readinessCheckController = async (
  _req: Request,
  res: Response
) => {
  const checks = await getDependencyChecks()
  const ready = Object.values(checks).every((check) => check.status === 'up')
  const response: ReadinessResponse = {
    ready,
    timestamp: new Date().toISOString(),
    checks
  }

  return res
    .status(ready ? HTTPSTATUS.OK : HTTPSTATUS.SERVICE_UNAVAILABLE)
    .json(response)
}

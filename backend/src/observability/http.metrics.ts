import type { RequestHandler } from 'express'
import { Counter, Gauge, Histogram } from 'prom-client'
import { metricsConfig } from './metrics.config'
import { metricsRegistry } from './metrics.registry'

const excludedRoutes = new Set(['/health', '/ready', metricsConfig.route])

const httpRequestsTotal = new Counter({
  name: 'finsight_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry]
})

const httpRequestDuration = new Histogram({
  name: 'finsight_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry]
})

const httpActiveRequests = new Gauge({
  name: 'finsight_http_active_requests',
  help: 'Current active HTTP requests',
  labelNames: ['method'] as const,
  registers: [metricsRegistry]
})

const normalizeRoute = (req: Parameters<RequestHandler>[0]) => {
  const routePath =
    typeof req.route?.path === 'string' ? req.route.path : 'unmatched'

  if (routePath === 'unmatched') return routePath

  const baseUrl = req.baseUrl === '/' ? '' : req.baseUrl
  return `${baseUrl}${routePath}` || '/'
}

export const httpMetricsMiddleware: RequestHandler = (req, res, next) => {
  if (!metricsConfig.enabled) {
    next()
    return
  }

  const method = req.method.toUpperCase()
  const startedAt = process.hrtime.bigint()
  httpActiveRequests.inc({ method })

  res.once('finish', () => {
    httpActiveRequests.dec({ method })

    const route = normalizeRoute(req)
    const requestPath = req.path || route
    if (excludedRoutes.has(requestPath) || excludedRoutes.has(route)) return

    const statusCode = String(res.statusCode)
    const durationSeconds =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000

    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode
    })
    httpRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode
      },
      durationSeconds
    )
  })

  next()
}

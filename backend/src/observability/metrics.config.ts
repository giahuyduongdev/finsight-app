import { Env } from '../config/env.config'

const parseBoolean = (value: string, fallback: boolean) => {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

const parsePositiveInteger = (value: string, fallback: number) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const metricsConfig = {
  enabled: parseBoolean(Env.METRICS_ENABLED, true),
  route: Env.METRICS_ROUTE.startsWith('/')
    ? Env.METRICS_ROUTE
    : `/${Env.METRICS_ROUTE}`,
  queuePollIntervalMs: parsePositiveInteger(
    Env.METRICS_QUEUE_POLL_INTERVAL_MS,
    15_000
  ),
  defaultIntervalMs: parsePositiveInteger(
    Env.METRICS_DEFAULT_INTERVAL_MS,
    10_000
  )
} as const

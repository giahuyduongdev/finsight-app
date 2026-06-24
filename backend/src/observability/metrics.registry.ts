import { collectDefaultMetrics, Registry } from 'prom-client'
import { metricsConfig } from './metrics.config'

export const metricsRegistry = new Registry()

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'finsight_',
  eventLoopMonitoringPrecision: metricsConfig.defaultIntervalMs
})

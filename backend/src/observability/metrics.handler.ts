import type { RequestHandler } from 'express'
import { metricsConfig } from './metrics.config'
import { metricsRegistry } from './metrics.registry'

export const metricsHandler: RequestHandler = async (_req, res) => {
  if (!metricsConfig.enabled) {
    res.status(404).send('Not found')
    return
  }

  res.type(metricsRegistry.contentType).send(await metricsRegistry.metrics())
}

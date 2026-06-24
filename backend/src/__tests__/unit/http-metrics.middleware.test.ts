import express from 'express'
import request from 'supertest'

describe('HTTP metrics middleware', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('records normalized Express route templates instead of raw IDs', async () => {
    const { httpMetricsMiddleware, metricsRegistry } =
      await import('../../observability')
    const app = express()
    app.use(httpMetricsMiddleware)
    app.get('/users/:id', (_req, res) => res.status(200).json({ ok: true }))

    await request(app).get('/users/user-123').expect(200)
    await request(app).get('/users/user-456').expect(200)

    const metrics = await metricsRegistry.metrics()

    expect(metrics).toContain('route="/users/:id"')
    expect(metrics).not.toContain('user-123')
    expect(metrics).not.toContain('user-456')
  })

  it('excludes health, readiness and metrics routes', async () => {
    const { httpMetricsMiddleware, metricsRegistry } =
      await import('../../observability')
    const app = express()
    app.use(httpMetricsMiddleware)
    app.get('/health', (_req, res) => res.sendStatus(200))
    app.get('/ready', (_req, res) => res.sendStatus(200))
    app.get('/metrics', (_req, res) => res.sendStatus(200))

    await request(app).get('/health').expect(200)
    await request(app).get('/ready').expect(200)
    await request(app).get('/metrics').expect(200)

    const metrics = await metricsRegistry.metrics()

    expect(metrics).not.toContain('route="/health"')
    expect(metrics).not.toContain('route="/ready"')
    expect(metrics).not.toContain('route="/metrics"')
  })
})

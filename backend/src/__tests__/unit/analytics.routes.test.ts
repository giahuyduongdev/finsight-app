import express, { Request, Response } from 'express'
import request from 'supertest'
import analyticsRoutes from '../../routes/v1/analytics.routes'

jest.mock('../../config/passport.config', () => ({
  passportAuthenticateJwt: (req: Request, res: Response, next: () => void) => {
    if (req.headers.authorization === 'Bearer test-token') return next()
    return res.status(401).json({ error: { code: 'UNAUTHORIZED' } })
  }
}))

jest.mock('../../controllers/analytics.controller', () => ({
  summaryAnalyticsController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'summary' } }),
  chartAnalyticsController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'chart' } }),
  expensePieChartBreakdownController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'expense-breakdown' } }),
  getExchangeRatesController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'rates' } }),
  refreshExchangeRatesController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'rates-refresh' } })
}))

describe('analytics routes', () => {
  const app = express()

  beforeAll(() => {
    app.use('/analytics', analyticsRoutes)
  })

  it('should protect manual exchange rate refresh', async () => {
    const unauthenticated = await request(app).post('/analytics/rates/refresh')
    const authenticated = await request(app)
      .post('/analytics/rates/refresh')
      .set('Authorization', 'Bearer test-token')

    expect(unauthenticated.status).toBe(401)
    expect(authenticated.status).toBe(200)
    expect(authenticated.body).toEqual({ data: { route: 'rates-refresh' } })
  })

  it('should protect all analytics read routes', async () => {
    const routes = [
      {
        path: '/analytics/summary',
        expectedBody: { data: { route: 'summary' } }
      },
      {
        path: '/analytics/chart',
        expectedBody: { data: { route: 'chart' } }
      },
      {
        path: '/analytics/expense-breakdown',
        expectedBody: { data: { route: 'expense-breakdown' } }
      },
      {
        path: '/analytics/rates',
        expectedBody: { data: { route: 'rates' } }
      }
    ]

    for (const route of routes) {
      const unauthenticated = await request(app).get(route.path)
      const authenticated = await request(app)
        .get(route.path)
        .set('Authorization', 'Bearer test-token')

      expect(unauthenticated.status).toBe(401)
      expect(authenticated.status).toBe(200)
      expect(authenticated.body).toEqual(route.expectedBody)
    }
  })
})

import { Router } from 'express'
import {
  summaryAnalyticsController,
  chartAnalyticsController,
  expensePieChartBreakdownController,
  getExchangeRatesController,
  refreshExchangeRatesController
} from '../../controllers/analytics.controller'
import { passportAuthenticateJwt } from '../../config/passport.config'

const analyticsRoutes = Router()

analyticsRoutes.get(
  '/summary',
  passportAuthenticateJwt,
  summaryAnalyticsController
)
analyticsRoutes.get('/chart', passportAuthenticateJwt, chartAnalyticsController)
analyticsRoutes.get(
  '/expense-breakdown',
  passportAuthenticateJwt,
  expensePieChartBreakdownController
)
analyticsRoutes.get(
  '/rates',
  passportAuthenticateJwt,
  getExchangeRatesController
)
analyticsRoutes.post(
  '/rates/refresh',
  passportAuthenticateJwt,
  refreshExchangeRatesController
)

export default analyticsRoutes

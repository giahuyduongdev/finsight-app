import { Router } from 'express'
import {
  summaryAnalyticsController,
  chartAnalyticsController,
  expensePieChartBreakdownController,
  getExchangeRatesController,
  refreshExchangeRatesController
} from '../../controllers/analytics.controller'

const analyticsRoutes = Router()

analyticsRoutes.get('/summary', summaryAnalyticsController)
analyticsRoutes.get('/chart', chartAnalyticsController)
analyticsRoutes.get('/expense-breakdown', expensePieChartBreakdownController)
analyticsRoutes.get('/rates', getExchangeRatesController)
analyticsRoutes.post('/rates/refresh', refreshExchangeRatesController)

export default analyticsRoutes

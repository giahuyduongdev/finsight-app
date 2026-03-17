import { Router } from 'express'
import {
  summaryAnalyticsController,
  chartAnalyticsController
} from '../controllers/analytics.controller'

const analyticsRoutes = Router()

analyticsRoutes.get('/summary', summaryAnalyticsController)
analyticsRoutes.get('/chart', chartAnalyticsController)

export default analyticsRoutes

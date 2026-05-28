import { Router } from 'express'
import {
  getAllReportsController,
  updateReportSettingController,
  generateReportController
} from '../controllers/report.controller'

const reportRoutes = Router()

reportRoutes.get('/all', getAllReportsController)
reportRoutes.get('/generate', generateReportController)
reportRoutes.put('/update-setting', updateReportSettingController)

export default reportRoutes

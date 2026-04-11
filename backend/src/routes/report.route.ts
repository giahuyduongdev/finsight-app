import { Router } from 'express'
import {
  getAllReportsController,
  updateReportSettingController,
  generateReportController,
  resendReportController
} from '../controllers/report.controller'

const reportRoutes = Router()

reportRoutes.get('/all', getAllReportsController)
reportRoutes.get('/generate', generateReportController)
reportRoutes.put('/update-setting', updateReportSettingController)
reportRoutes.post('/resend/:reportId', resendReportController)

export default reportRoutes

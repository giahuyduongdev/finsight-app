import { Router } from 'express'
import {
  getAllReportsController,
  updateReportSettingController,
  generateReportController,
  resendReportController
} from '../../controllers/report.controller'
import { validate } from '../../middlewares/validate.middleware'
import { updateReportSettingSchema } from '../../validators/report.validator'

const reportRoutes = Router()

reportRoutes.get('/', getAllReportsController)
reportRoutes.get('/generate', generateReportController)
reportRoutes.patch(
  '/settings',
  validate(updateReportSettingSchema, 'body'),
  updateReportSettingController
)
reportRoutes.post('/resend/:reportId', resendReportController)

export default reportRoutes

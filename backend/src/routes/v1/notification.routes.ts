import { Router } from 'express'
import {
  getNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController
} from '../../controllers/notification.controller'

const notificationRoutes = Router()

notificationRoutes.get('/', getNotificationsController)
notificationRoutes.patch('/read-all', markAllNotificationsReadController)
notificationRoutes.patch(
  '/:notificationId/read',
  markNotificationReadController
)

export default notificationRoutes

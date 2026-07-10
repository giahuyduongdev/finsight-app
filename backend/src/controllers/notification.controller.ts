import { Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { container } from '../container'
import {
  toNotificationListResponse,
  toNotificationResponse
} from '../dtos/notification.dto'
import { asyncHandler } from '../middlewares/asyncHandler.middleware'
import { parsePaginationQuery } from '../utils/query-parser.util'
import { ResponseFormatter } from '../utils/responseFormatter.util'
import { getUserId } from '../utils/getUserId.util'

const notificationService = container.getNotificationService()

const parseUnreadOnly = (value: unknown): boolean =>
  value === 'true' || value === true

export const getNotificationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const pagination = parsePaginationQuery(req.query, { pageSize: 20 })
    const result = await notificationService.findByUserId(userId, {
      ...pagination,
      unreadOnly: parseUnreadOnly(req.query.unreadOnly)
    })
    const response = ResponseFormatter.paginated(
      toNotificationListResponse(result.data),
      result.pagination,
      req
    )

    return res.status(HTTPSTATUS.OK).json({
      ...response,
      meta: {
        ...response.meta,
        unreadCount: result.unreadCount
      }
    })
  }
)

export const markNotificationReadController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const notificationId = req.params.notificationId as string
    const notification = await notificationService.markAsRead(
      userId,
      notificationId
    )

    return res
      .status(HTTPSTATUS.OK)
      .json(ResponseFormatter.success(toNotificationResponse(notification)))
  }
)

export const markAllNotificationsReadController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req)
    const result = await notificationService.markAllAsRead(userId)

    return res.status(HTTPSTATUS.OK).json(ResponseFormatter.success(result))
  }
)

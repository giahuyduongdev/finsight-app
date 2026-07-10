import mongoose from 'mongoose'
import NotificationModel, {
  NotificationDocument
} from '../models/notification.model'
import {
  CreateNotificationInput,
  FindNotificationsOptions,
  INotificationRepository,
  MarkAllAsReadResult
} from './interfaces/notification-repository.interface'
import { PaginatedResult } from '../types/repository.type'

export class NotificationRepository implements INotificationRepository {
  async create(input: CreateNotificationInput): Promise<NotificationDocument> {
    return await NotificationModel.create({
      ...input,
      userId: new mongoose.Types.ObjectId(input.userId),
      unread: true,
      readAt: null
    })
  }

  async findByUserId(
    userId: string,
    options: FindNotificationsOptions
  ): Promise<PaginatedResult<NotificationDocument>> {
    const { pageNumber, pageSize, unreadOnly } = options
    const skip = (pageNumber - 1) * pageSize
    const query = {
      userId: new mongoose.Types.ObjectId(userId),
      ...(unreadOnly ? { unread: true } : {})
    }

    const [notifications, totalCount] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      NotificationModel.countDocuments(query)
    ])

    return {
      data: notifications,
      pagination: {
        pageSize,
        pageNumber,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        skip
      }
    }
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return await NotificationModel.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      unread: true
    })
  }

  async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<NotificationDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) return null

    return await NotificationModel.findOneAndUpdate(
      {
        _id: notificationId,
        userId: new mongoose.Types.ObjectId(userId)
      },
      {
        unread: false,
        readAt: new Date()
      },
      { new: true }
    )
  }

  async markAllAsRead(userId: string): Promise<MarkAllAsReadResult> {
    const result = await NotificationModel.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        unread: true
      },
      {
        unread: false,
        readAt: new Date()
      }
    )

    return { updatedCount: result.modifiedCount }
  }
}

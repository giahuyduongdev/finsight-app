import { logger } from '../config/logger.config'
import { CreateNotificationInput } from '../repositories/interfaces/notification-repository.interface'

export const createSystemNotification = async (
  input: CreateNotificationInput
): Promise<void> => {
  try {
    const { container } = await import('../container')
    await container.getNotificationService().create(input)
  } catch (error) {
    logger.warn('[APP:Notification] Failed to create system notification', {
      userId: input.userId,
      type: input.type,
      idempotencyKey: input.idempotencyKey,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

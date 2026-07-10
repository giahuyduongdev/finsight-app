const foregroundHandledEntityIds = new Set<string>()

export const markNotificationHandledInForeground = (entityId: string) => {
  foregroundHandledEntityIds.add(entityId)
}

export const consumeNotificationHandledInForeground = (entityId?: string) => {
  if (!entityId || !foregroundHandledEntityIds.has(entityId)) return false

  foregroundHandledEntityIds.delete(entityId)
  return true
}

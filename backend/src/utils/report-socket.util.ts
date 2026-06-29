import { getIO } from '../config/socket.config'
import { logger } from '../config/logger.config'

export type ReportLifecycleStatus =
  'SENT' | 'FAILED' | 'NO_ACTIVITY' | 'PENDING'

export type ReportListUpdatedReason = 'generated' | 'resent' | 'status-updated'

export type ReportListUpdatedSource = 'api' | 'worker'

export interface ReportListUpdatedPayload {
  userId: string
  reason: ReportListUpdatedReason
  reportId?: string
  status?: ReportLifecycleStatus
  period?: string
  source: ReportListUpdatedSource
  updatedAt?: string
}

export const emitReportListUpdated = (
  payload: ReportListUpdatedPayload
): void => {
  const eventPayload = {
    ...payload,
    updatedAt: payload.updatedAt ?? new Date().toISOString()
  }

  try {
    getIO().to(payload.userId).emit('report:list-updated', eventPayload)
  } catch (error) {
    logger.warn('[APP:Report] Failed to emit report lifecycle socket event', {
      userId: payload.userId,
      reason: payload.reason,
      reportId: payload.reportId,
      status: payload.status,
      source: payload.source,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

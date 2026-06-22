const normalizeDueDate = (dueDate: Date | string): Date => {
  const parsed = dueDate instanceof Date ? dueDate : new Date(dueDate)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid report due date')
  }

  return parsed
}

export const buildReportDeliveryKey = (
  settingId: string,
  dueDate: Date | string
): string => `report/${settingId}/${normalizeDueDate(dueDate).toISOString()}`

export const buildReportJobId = (
  settingId: string,
  dueDate: Date | string
): string =>
  `process-report-${settingId}-${normalizeDueDate(dueDate).getTime().toString()}`

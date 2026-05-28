import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  addQuarters,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear
} from 'date-fns'
import { ReportFrequencyEnum } from '../../enums/report-frequency.enum'

/**
 * Calculate the next report date based on frequency
 *
 * @param lastSentDate - The date when the report was last sent (defaults to now)
 * @param frequency - Report frequency (DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY)
 * @returns Next scheduled report date
 *
 * @example
 * ```typescript
 * // Calculate next monthly report
 * const nextDate = calculateNextReportDate(
 *   new Date('2024-01-15'),
 *   'MONTHLY'
 * )
 * // Returns: 2024-02-01 00:00:00
 *
 * // Calculate next weekly report
 * const nextWeekly = calculateNextReportDate(
 *   new Date('2024-01-15'),
 *   'WEEKLY'
 * )
 * // Returns: 2024-01-22 (start of next week)
 * ```
 */
export const calculateNextReportDate = (
  lastSentDate?: Date,
  frequency: keyof typeof ReportFrequencyEnum = 'MONTHLY'
): Date => {
  const lastSent = lastSentDate ?? new Date()
  let nextDate: Date

  switch (frequency) {
    case 'DAILY':
      nextDate = addDays(lastSent, 1)
      nextDate.setHours(0, 0, 0, 0)
      break
    case 'WEEKLY':
      nextDate = startOfWeek(addWeeks(lastSent, 1), { weekStartsOn: 1 })
      break
    case 'QUARTERLY':
      nextDate = startOfQuarter(addQuarters(lastSent, 1))
      break
    case 'ANNUALLY':
      nextDate = startOfYear(addYears(lastSent, 1))
      break
    case 'MONTHLY':
    default:
      nextDate = startOfMonth(addMonths(lastSent, 1))
      break
  }

  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

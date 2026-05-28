import { addDays, addWeeks, addMonths, addYears } from 'date-fns'
import { RecurringIntervalEnum } from '../../models/transaction.model'

/**
 * Calculate the next occurrence date for recurring transactions
 *
 * @param date - The current/last occurrence date
 * @param recurringInterval - Interval type (DAILY, WEEKLY, MONTHLY, YEARLY)
 * @returns Next occurrence date
 *
 * @example
 * ```typescript
 * // Calculate next monthly occurrence
 * const next = calculateNextOccurrence(
 *   new Date('2024-01-15'),
 *   RecurringIntervalEnum.MONTHLY
 * )
 * // Returns: 2024-02-15 00:00:00
 *
 * // Calculate next weekly occurrence
 * const nextWeek = calculateNextOccurrence(
 *   new Date('2024-01-15'),
 *   RecurringIntervalEnum.WEEKLY
 * )
 * // Returns: 2024-01-22 00:00:00
 * ```
 */
export const calculateNextOccurrence = (
  date: Date,
  recurringInterval: keyof typeof RecurringIntervalEnum
): Date => {
  const base = new Date(date)
  base.setHours(0, 0, 0, 0)

  switch (recurringInterval) {
    case RecurringIntervalEnum.DAILY:
      return addDays(base, 1)
    case RecurringIntervalEnum.WEEKLY:
      return addWeeks(base, 1)
    case RecurringIntervalEnum.MONTHLY:
      return addMonths(base, 1)
    case RecurringIntervalEnum.YEARLY:
      return addYears(base, 1)
    default:
      return base
  }
}

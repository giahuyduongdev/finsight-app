import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subYears
} from 'date-fns'
import { DateRangeEnum, DateRangePreset } from '../../enums/date-range.enum'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { addDays, addMonths, addWeeks, addYears, addQuarters } from 'date-fns'
import { ReportFrequencyEnum } from '../../enums/report-frequency.enum'
import { RecurringIntervalEnum } from '../../models/transaction.model'

// backend/src/utils/dates/index.ts
export const getDateRange = (
  preset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date,
  timezone: string = 'UTC'
) => {
  const isValidDate = (d?: Date) =>
    d instanceof Date && !Number.isNaN(d.getTime())

  const hasCustomFrom = isValidDate(customFrom)
  const hasCustomTo = isValidDate(customTo)

  // Use Preset unless it's explicitly CUSTOM or missing while customs are present
  let effectivePreset = preset
  if (!effectivePreset && (hasCustomFrom || hasCustomTo)) {
    effectivePreset = DateRangeEnum.CUSTOM
  }

  const now = toZonedTime(new Date(), timezone) // đổi sang giờ user

  const today = endOfDay(now)
  const last30Days = {
    from: fromZonedTime(subDays(today, 29), timezone),
    to: fromZonedTime(today, timezone),
    value: DateRangeEnum.LAST_30_DAYS,
    label: 'Last 30 Days'
  }

  switch (effectivePreset) {
    case DateRangeEnum.ALL_TIME:
      return {
        from: null,
        to: null,
        value: DateRangeEnum.ALL_TIME,
        label: 'All Time'
      }
    case DateRangeEnum.LAST_30_DAYS:
      return last30Days
    case DateRangeEnum.LAST_MONTH:
      return {
        from: fromZonedTime(startOfMonth(subMonths(now, 1)), timezone),
        to: fromZonedTime(endOfMonth(subMonths(now, 1)), timezone),
        value: DateRangeEnum.LAST_MONTH,
        label: 'Last Month'
      }
    case DateRangeEnum.LAST_3_MONTHS:
      return {
        from: fromZonedTime(startOfMonth(subMonths(now, 3)), timezone),
        to: fromZonedTime(endOfMonth(subMonths(now, 1)), timezone),
        value: DateRangeEnum.LAST_3_MONTHS,
        label: 'Last 3 Months'
      }
    case DateRangeEnum.LAST_YEAR:
      return {
        from: fromZonedTime(startOfYear(subYears(now, 1)), timezone),
        to: fromZonedTime(endOfYear(subYears(now, 1)), timezone),
        value: DateRangeEnum.LAST_YEAR,
        label: 'Last Year'
      }
    case DateRangeEnum.THIS_MONTH:
      return {
        from: fromZonedTime(startOfMonth(now), timezone),
        to: fromZonedTime(endOfDay(now), timezone),
        value: DateRangeEnum.THIS_MONTH,
        label: 'This Month'
      }
    case DateRangeEnum.THIS_YEAR:
      return {
        from: fromZonedTime(startOfYear(now), timezone),
        to: fromZonedTime(endOfDay(now), timezone),
        value: DateRangeEnum.THIS_YEAR,
        label: 'This Year'
      }
    case DateRangeEnum.CUSTOM:
      return {
        from: hasCustomFrom ? customFrom! : null,
        to: hasCustomTo ? customTo! : null,
        value: DateRangeEnum.CUSTOM,
        label: 'Custom Range'
      }
    default:
      return last30Days
  }
}

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
      nextDate = addWeeks(lastSent, 1)
      nextDate.setHours(0, 0, 0, 0)
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

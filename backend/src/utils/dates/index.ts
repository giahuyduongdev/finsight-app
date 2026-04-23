import {
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears
} from 'date-fns'
import { DateRangeEnum, DateRangePreset } from '../../enums/date-range.enum'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { addDays, addMonths, addWeeks, addYears } from 'date-fns'
import { RecurringIntervalEnum } from '../../models/transaction.model'

export const getDateRange = (
  preset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date,
  timezone: string = 'UTC' // Thêm vào
) => {
  // Chỉ ưu tiên custom range NẾU preset là CUSTOM hoặc không có preset
  if ((!preset || preset === DateRangeEnum.CUSTOM) && customFrom && customTo) {
    return {
      from: customFrom,
      to: customTo,
      value: DateRangeEnum.CUSTOM
    }
  }

  const now = toZonedTime(new Date(), timezone) // đổi sang giờ user

  const today = endOfDay(now)
  const last30Days = {
    from: fromZonedTime(subDays(today, 29), timezone),
    to: fromZonedTime(today, timezone),
    value: DateRangeEnum.LAST_30_DAYS,
    label: 'Last 30 Days'
  }

  switch (preset) {
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
        from: customFrom || null,
        to: customTo || null,
        value: DateRangeEnum.CUSTOM,
        label: 'Custom Range'
      }
    default:
      return last30Days
  }
}

export const calculateNextReportDate = (lastSentDate?: Date): Date => {
  const lastSent = lastSentDate ?? new Date()
  const nextDate = startOfMonth(addMonths(lastSent, 1))
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

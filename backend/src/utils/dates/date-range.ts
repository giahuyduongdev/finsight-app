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
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { DateRangeEnum, DateRangePreset } from '../../enums/date-range.enum'

/**
 * Get date range based on preset or custom dates
 *
 * @param preset - Predefined date range preset (e.g., LAST_30_DAYS, THIS_MONTH)
 * @param customFrom - Custom start date (used when preset is CUSTOM)
 * @param customTo - Custom end date (used when preset is CUSTOM)
 * @param timezone - Timezone for date calculations (default: UTC)
 * @returns Object containing from/to dates, value, and label
 *
 * @example
 * ```typescript
 * // Get last 30 days
 * const range = getDateRange(DateRangeEnum.LAST_30_DAYS)
 *
 * // Get custom range
 * const custom = getDateRange(
 *   DateRangeEnum.CUSTOM,
 *   new Date('2024-01-01'),
 *   new Date('2024-01-31')
 * )
 * ```
 */
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

  const now = toZonedTime(new Date(), timezone) // Convert to user timezone

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

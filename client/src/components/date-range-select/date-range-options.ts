import {
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears
} from 'date-fns'

export const DateRangeEnum = {
  LAST_30_DAYS: '30days',
  LAST_MONTH: 'lastMonth',
  LAST_3_MONTHS: 'last3Months',
  LAST_YEAR: 'lastYear',
  THIS_MONTH: 'thisMonth',
  THIS_YEAR: 'thisYear',
  ALL_TIME: 'allTime',
  CUSTOM: 'custom'
} as const

export type DateRangeEnumType =
  (typeof DateRangeEnum)[keyof typeof DateRangeEnum]

export type DateRangeType = {
  from: Date | null
  to: Date | null
  value?: string
  label: string
} | null

export type DateRangePreset = {
  label: string
  value: string
  getRange: () => DateRangeType
}

const today = new Date()

export const presets: DateRangePreset[] = [
  {
    label: 'Last 30 Days',
    value: DateRangeEnum.LAST_30_DAYS,
    getRange: () => ({
      from: startOfDay(subDays(today, 30)),
      to: endOfDay(today),
      value: DateRangeEnum.LAST_30_DAYS,
      label: 'for Past 30 Days'
    })
  },
  {
    label: 'Last Month',
    value: DateRangeEnum.LAST_MONTH,
    getRange: () => {
      const lastMonth = subMonths(today, 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfDay(subDays(startOfMonth(today), 1)),
        value: DateRangeEnum.LAST_MONTH,
        label: 'for Last Month'
      }
    }
  },
  {
    label: 'Last 3 Months',
    value: DateRangeEnum.LAST_3_MONTHS,
    getRange: () => {
      const start = startOfMonth(subMonths(today, 3))
      return {
        from: start,
        to: endOfDay(subDays(startOfMonth(today), 1)),
        value: DateRangeEnum.LAST_3_MONTHS,
        label: 'for Past 3 Months'
      }
    }
  },
  {
    label: 'Last Year',
    value: DateRangeEnum.LAST_YEAR,
    getRange: () => {
      const lastYear = subYears(today, 1)
      return {
        from: startOfYear(lastYear),
        to: endOfDay(subDays(startOfYear(today), 1)),
        value: DateRangeEnum.LAST_YEAR,
        label: 'for Past Year'
      }
    }
  },
  {
    label: 'This Month',
    value: DateRangeEnum.THIS_MONTH,
    getRange: () => ({
      from: startOfMonth(today),
      to: endOfDay(today),
      value: DateRangeEnum.THIS_MONTH,
      label: 'for This Month'
    })
  },
  {
    label: 'This Year',
    value: DateRangeEnum.THIS_YEAR,
    getRange: () => ({
      from: startOfYear(today),
      to: endOfDay(today),
      value: DateRangeEnum.THIS_YEAR,
      label: 'for This Year'
    })
  },
  {
    label: 'All Time',
    value: DateRangeEnum.ALL_TIME,
    getRange: () => ({
      from: null,
      to: null,
      value: DateRangeEnum.ALL_TIME,
      label: 'across All Time'
    })
  },
  {
    label: 'Custom Range',
    value: DateRangeEnum.CUSTOM,
    getRange: () => ({
      from: null,
      to: null,
      value: DateRangeEnum.CUSTOM,
      label: 'Custom Range'
    })
  }
]

export const getDateRangeByPreset = (
  presetValue: DateRangeEnumType = DateRangeEnum.ALL_TIME
) => presets.find((preset) => preset.value === presetValue)?.getRange() ?? null

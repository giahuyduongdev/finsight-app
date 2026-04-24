import { useEffect, useState } from 'react'
import {
  format,
  subDays,
  subMonths,
  subYears,
  startOfMonth,
  startOfYear,
  startOfDay,
  endOfDay
} from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ChevronDownIcon } from 'lucide-react'
import { Calendar } from '../ui/calendar'
import { DateRange } from 'react-day-picker'

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

type DateRangePreset = {
  label: string
  value: string
  getRange: () => DateRangeType
}

interface DateRangeSelectProps {
  dateRange: DateRangeType
  setDateRange: (range: DateRangeType) => void
  defaultRange?: DateRangeEnumType
}

const today = new Date()

const presets: DateRangePreset[] = [
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

export const DateRangeSelect = ({
  dateRange,
  setDateRange,
  defaultRange = DateRangeEnum.LAST_30_DAYS
}: DateRangeSelectProps) => {
  const [open, setOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined)

  // Sync pendingRange when popover opens and it's a custom range
  useEffect(() => {
    if (open && dateRange?.value === DateRangeEnum.CUSTOM) {
      setPendingRange({
        from: dateRange?.from || undefined,
        to: dateRange?.to || undefined
      })
    }
  }, [open, dateRange])

  const displayText = dateRange
    ? presets.find((p) => p.value === dateRange.value)?.label ||
      (dateRange.from
        ? `${format(dateRange.from, 'MMM dd, y')} - ${
            dateRange.to ? format(dateRange.to, 'MMM dd, y') : 'Present'
          }`
        : 'Select a duration')
    : 'Select a duration'

  // Set default range on initial render
  useEffect(() => {
    if (!dateRange) {
      const defaultPreset = presets.find((p) => p.value === defaultRange)
      if (defaultPreset) {
        setDateRange(defaultPreset.getRange())
      }
    }
  }, [dateRange, defaultRange, setDateRange])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm text-foreground whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none h-9 !cursor-pointer min-w-[160px]",
            !dateRange && 'text-muted-foreground'
          )}
        >
          <div className="flex items-center gap-2">
             <ChevronDownIcon className="size-4 opacity-50" />
             <span className="truncate">{displayText}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 flex flex-col md:flex-row" align="start">
        <div className="grid py-1 border-r min-w-[160px]">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Presets
          </div>
          {presets.map((preset) => (
            <Button
              key={preset.value}
              variant="ghost"
              className={cn(
                'justify-start text-left font-normal h-9',
                dateRange?.value === preset.value && 'bg-accent text-accent-foreground'
              )}
              onClick={() => {
                setDateRange(preset.getRange())
                if (preset.value !== DateRangeEnum.CUSTOM) {
                  setOpen(false)
                }
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        {dateRange?.value === DateRangeEnum.CUSTOM && (
          <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={pendingRange?.from || dateRange?.from || undefined}
              selected={pendingRange}
              onSelect={setPendingRange}
              numberOfMonths={1}
              className="p-3"
            />
            <div className="flex items-center justify-end gap-2 p-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                   setPendingRange(undefined)
                   setOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 !bg-[var(--secondary-dark-color)] text-white"
                onClick={() => {
                  setDateRange({
                    from: pendingRange?.from ? startOfDay(pendingRange.from) : null,
                    to: pendingRange?.to ? endOfDay(pendingRange.to) : (pendingRange?.from ? endOfDay(pendingRange.from) : null),
                    value: DateRangeEnum.CUSTOM,
                    label: 'Custom Range'
                  })
                  setOpen(false)
                }}
              >
                Apply Range
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

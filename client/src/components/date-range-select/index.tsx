import { useEffect, useReducer } from 'react'
import { format, startOfDay, endOfDay } from 'date-fns'
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
import { DateRangeEnum, DateRangeType, presets } from './date-range-options'

interface DateRangeSelectProps {
  dateRange: DateRangeType
  setDateRange: (range: DateRangeType) => void
}

export const DateRangeSelect = ({
  dateRange,
  setDateRange
}: DateRangeSelectProps) => {
  const [open, updateOpen] = useReducer(
    (_current: boolean, nextOpen: boolean) => nextOpen,
    false
  )
  const [pendingRange, updatePendingRange] = useReducer(
    (_current: DateRange | undefined, nextRange: DateRange | undefined) =>
      nextRange,
    undefined
  )

  // Sync pendingRange when popover opens and it's a custom range
  useEffect(() => {
    if (open && dateRange?.value === DateRangeEnum.CUSTOM) {
      updatePendingRange({
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

  return (
    <Popover open={open} onOpenChange={updateOpen}>
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
      <PopoverContent
        className="w-auto p-0 flex flex-col md:flex-row"
        align="start"
      >
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
                dateRange?.value === preset.value &&
                  'bg-accent text-accent-foreground'
              )}
              onClick={() => {
                setDateRange(preset.getRange())
                if (preset.value !== DateRangeEnum.CUSTOM) {
                  updateOpen(false)
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
              onSelect={updatePendingRange}
              numberOfMonths={1}
              className="p-3"
            />
            <div className="flex items-center justify-end gap-2 p-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  updatePendingRange(undefined)
                  updateOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 !bg-[var(--secondary-dark-color)] text-white"
                onClick={() => {
                  setDateRange({
                    from: pendingRange?.from
                      ? startOfDay(pendingRange.from)
                      : null,
                    to: pendingRange?.to
                      ? endOfDay(pendingRange.to)
                      : pendingRange?.from
                        ? endOfDay(pendingRange.from)
                        : null,
                    value: DateRangeEnum.CUSTOM,
                    label: 'Custom Range'
                  })
                  updateOpen(false)
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

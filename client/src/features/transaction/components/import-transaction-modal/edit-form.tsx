import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  CURRENCY_ENUM,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  CurrencyType
} from '@/constant'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import CurrencyInputField from '@/components/ui/currency-input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ParsedTransaction } from './types'
import { ZERO_DECIMAL_CURRENCIES } from '@/lib/format-currency'

interface EditFormProps {
  transaction: ParsedTransaction
  index: string
  onUpdate: (id: string, data: ParsedTransaction) => void
  onClose: () => void
  open: boolean
}

const useEditFormView = ({
  transaction,
  index: rowId,
  onUpdate,
  onClose,
  open
}: EditFormProps) => {
  const [formData, setFormData] = useState<ParsedTransaction>({
    ...transaction
  })
  const [displayAmount, setDisplayAmount] = useState<string>(
    String(transaction.amount)
  )
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date(transaction.date)
    if (isNaN(d.getTime())) return ''

    // Use UTC parts to avoid local timezone day-shift when reading ISO strings
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate date to prevent RangeError
    let dateObj = new Date(dateStr)

    // Handle YYYY-MM-DD in local time to match initial mapping logic and prevent UTC day-shift
    const dateMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (dateMatch) {
      const y = Number(dateMatch[1])
      const m = Number(dateMatch[2])
      const d = Number(dateMatch[3])
      dateObj = new Date(y, m - 1, d)

      // Strict validation: Check if normalization happened (e.g. Feb 31 -> Mar 3)
      const isSameCalendarDate =
        dateObj.getFullYear() === y &&
        dateObj.getMonth() === m - 1 &&
        dateObj.getDate() === d

      if (!isSameCalendarDate) {
        toast.error('Invalid calendar date', {
          description:
            'Please enter a valid date (e.g., February only has 28 or 29 days).'
        })
        return
      }

      // If valid, use UTC midday to prevent date jumping to previous day in Western timezones
      dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    }

    if (isNaN(dateObj.getTime())) {
      toast.error('Transaction missing valid date', {
        description: 'Please select or enter a valid date format.'
      })
      return
    }

    let finalAmount = formData.amount
    if (ZERO_DECIMAL_CURRENCIES.includes(formData.currency || 'USD')) {
      finalAmount = Math.round(finalAmount)
    }

    onUpdate(rowId, {
      ...formData,
      amount: finalAmount,
      date: dateObj.toISOString()
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px] z-[150]">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Make changes to your transaction details here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1.5">
            <label
              htmlFor={`title-${rowId}`}
              className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider cursor-pointer"
            >
              Title
            </label>
            <Input
              id={`title-${rowId}`}
              value={formData.title}
              className="h-9 text-sm"
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor={`amount-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider cursor-pointer"
              >
                Amount
              </label>
              <CurrencyInputField
                id={`amount-${rowId}`}
                name={`amount-edit-${rowId}`}
                value={displayAmount}
                prefix={
                  CURRENCY_SYMBOLS[formData.currency as CurrencyType] || '$'
                }
                decimalsLimit={
                  ZERO_DECIMAL_CURRENCIES.includes(formData.currency || 'USD')
                    ? 0
                    : 2
                }
                allowDecimals={
                  !ZERO_DECIMAL_CURRENCIES.includes(formData.currency || 'USD')
                }
                className="h-9 text-sm"
                onValueChange={(val) => {
                  setDisplayAmount(val || '')
                  setFormData((prev) => ({ ...prev, amount: Number(val || 0) }))
                }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`currency-${rowId}`}
                id={`currency-label-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider"
              >
                Currency
              </label>
              <Select
                value={formData.currency || CURRENCY_ENUM.USD}
                onValueChange={(val) => {
                  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(
                    val || 'USD'
                  )
                  setFormData((prev) => ({
                    ...prev,
                    currency: val,
                    amount: isZeroDecimal
                      ? Math.round(prev.amount)
                      : prev.amount
                  }))
                  if (isZeroDecimal) {
                    setDisplayAmount((prev) =>
                      Math.round(Number(prev || 0)).toString()
                    )
                  }
                }}
              >
                <SelectTrigger
                  id={`currency-${rowId}`}
                  aria-labelledby={`currency-label-${rowId}`}
                  className="h-9 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] z-[300]">
                  {CURRENCY_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-xs"
                    >
                      <span className="font-bold">{opt.value}</span> -{' '}
                      {opt.label.split(' - ')[1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor={`type-${rowId}`}
                id={`type-label-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider"
              >
                Type
              </label>
              <span className="sr-only">Type</span>
              <Select
                value={formData.type}
                onValueChange={(val: 'INCOME' | 'EXPENSE') =>
                  setFormData((prev) => ({ ...prev, type: val }))
                }
              >
                <SelectTrigger
                  id={`type-${rowId}`}
                  aria-labelledby={`type-label-${rowId}`}
                  className="h-9 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  <SelectItem
                    value="INCOME"
                    className="text-emerald-600 font-bold"
                  >
                    INCOME
                  </SelectItem>
                  <SelectItem
                    value="EXPENSE"
                    className="text-rose-600 font-bold"
                  >
                    EXPENSE
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`status-${rowId}`}
                id={`status-label-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider"
              >
                Status
              </label>
              <Select
                value={formData.status || 'COMPLETED'}
                onValueChange={(val) =>
                  setFormData((prev) => ({ ...prev, status: val }))
                }
              >
                <SelectTrigger
                  id={`status-${rowId}`}
                  aria-labelledby={`status-label-${rowId}`}
                  className="h-9 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  <SelectItem
                    value="COMPLETED"
                    className="text-emerald-600 font-medium"
                  >
                    Completed
                  </SelectItem>
                  <SelectItem
                    value="PENDING"
                    className="text-orange-500 font-medium"
                  >
                    Pending
                  </SelectItem>
                  <SelectItem
                    value="FAILED"
                    className="text-rose-600 font-medium"
                  >
                    Failed
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor={`category-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider cursor-pointer"
              >
                Category
              </label>
              <Input
                id={`category-${rowId}`}
                value={formData.category}
                className="h-9 text-sm"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, category: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`date-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider cursor-pointer"
              >
                Date
              </label>
              <Input
                id={`date-${rowId}`}
                type="date"
                value={dateStr}
                className="h-9 text-sm"
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t mt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export const EditForm = (props: EditFormProps) => useEditFormView(props)

import { useState, useMemo, useRef } from 'react'
import { z } from 'zod'
import { ChevronLeft, FileCheck, AlertCircle, CheckCircle2, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, ZERO_DECIMAL_CURRENCIES } from '@/lib/format-currency'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { _TRANSACTION_TYPE, PAYMENT_METHODS_ENUM, CURRENCY_ENUM, CURRENCY_OPTIONS, CURRENCY_SYMBOLS, CurrencyType } from '@/constant'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CurrencyInputField from '@/components/ui/currency-input'
import { toast } from 'sonner'
import { MAX_IMPORT_LIMIT } from '@/constant'
import { BulkTransactionType } from '@/features/transaction/transationType'
import { useBulkImportTransactionMutation } from '@/features/transaction/transactionAPI'
import { useVirtualizer } from '@tanstack/react-virtual'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────────────────

type CsvRowWrapper = {
  id: string
  data: Record<string, string | undefined>
}

type ConfirmationStepProps = {
  file: File | null
  mappings: Record<string, string>
  csvData: Record<string, string | undefined>[]
  onComplete: () => void
  onBack: () => void
}

type ParsedTransaction = {
  title: string
  amount: number
  date: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  paymentMethod?: string
  status?: string
  currency?: string
  isRecurring: boolean
  description: string
}
// ─── Schema ───────────────────────────────────────────────────────────────────

const transactionSchema = z.object({
  title: z.string({ required_error: 'Title is required' }),
  amount: z
    .number({
      invalid_type_error: 'Amount must be a number',
      required_error: 'Amount is required'
    })
    .positive('Amount must be greater than zero'),
  date: z.preprocess(
    (val) => new Date(val as string),
    z.date({
      invalid_type_error: 'Invalid date format',
      required_error: 'Date is required'
    })
  ),
  type: z.enum([_TRANSACTION_TYPE.INCOME, _TRANSACTION_TYPE.EXPENSE], {
    invalid_type_error: 'Invalid transaction type',
    required_error: 'Transaction type is required'
  }),
  category: z.string({ required_error: 'Category is required' }),
  paymentMethod: z
    .union([
      z.literal(''),
      z.undefined(),
      z.enum(
        [
          PAYMENT_METHODS_ENUM.CARD,
          PAYMENT_METHODS_ENUM.BANK_TRANSFER,
          PAYMENT_METHODS_ENUM.MOBILE_PAYMENT,
          PAYMENT_METHODS_ENUM.AUTO_DEBIT,
          PAYMENT_METHODS_ENUM.CASH,
          PAYMENT_METHODS_ENUM.OTHER
        ],
        {
          errorMap: (issue) => ({
            message:
              issue.code === 'invalid_enum_value'
                ? `Payment method must be one of: ${Object.values(PAYMENT_METHODS_ENUM).join(', ')}`
                : 'Invalid payment method'
          })
        }
      )
    ])
    .transform((val) => (val === '' ? undefined : val))
    .optional(),
  status: z
    .union([
      z.literal(''),
      z.undefined(),
      z
        .string()
        .toUpperCase()
        .pipe(
          z.enum(['COMPLETED', 'PENDING', 'FAILED'], {
            errorMap: () => ({
              message: 'Status must be COMPLETED, PENDING, or FAILED'
            })
          })
        )
    ])
    .transform((val) => (val === '' ? undefined : val))
    .optional(),
  currency: z.string().refine((val) => Object.values(CURRENCY_ENUM).includes(val as any), {
    message: `Invalid currency. Supported: ${Object.values(CURRENCY_ENUM).join(', ')}`
  }).optional()
})

type ParsedRow = {
  id: string
  data: ParsedTransaction | null
  error?: string
  isValid: boolean
}

// ─── Sub-component: Edit Form ───────────────────────────────────────────────

const EditForm = ({ transaction, index: rowId, onUpdate, onClose, open }: {
  transaction: ParsedTransaction
  index: string
  onUpdate: (id: string, data: ParsedTransaction) => void
  onClose: () => void
  open: boolean
}) => {
  const [formData, setFormData] = useState<ParsedTransaction>({ ...transaction })
  const [displayAmount, setDisplayAmount] = useState<string>(String(transaction.amount))
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date(transaction.date)
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate date to prevent RangeError
    const dateObj = new Date(dateStr)
    if (isNaN(dateObj.getTime())) {
      toast.error('Giao dịch chưa có ngày tháng hợp lệ', {
        description: 'Vui lòng chọn hoặc nhập ngày tháng đúng định dạng.'
      })
      return
    }

    let finalAmount = formData.amount
    if (ZERO_DECIMAL_CURRENCIES.includes(formData.currency || 'USD')) {
      finalAmount = Math.round(finalAmount)
    }

    onUpdate(rowId, { ...formData, amount: finalAmount, date: dateObj.toISOString() })
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
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
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
                prefix={CURRENCY_SYMBOLS[formData.currency as CurrencyType] || '$'}
                decimalsLimit={ZERO_DECIMAL_CURRENCIES.includes(formData.currency || 'USD') ? 0 : 2}
                allowDecimals={!ZERO_DECIMAL_CURRENCIES.includes(formData.currency || 'USD')}
                className="h-9 text-sm"
                onValueChange={(val) => {
                  setDisplayAmount(val || '')
                  setFormData(prev => ({ ...prev, amount: Number(val || 0) }))
                }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label 
                id={`currency-label-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider"
              >
                Currency
              </label>
              <Select 
                value={formData.currency || CURRENCY_ENUM.USD}
                onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
              >
                <SelectTrigger 
                  aria-labelledby={`currency-label-${rowId}`}
                  className="h-9 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] z-[300]">
                  {CURRENCY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      <span className="font-bold">{opt.value}</span> - {opt.label.split(' - ')[1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label 
                id={`type-label-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider"
              >
                Type
              </label>
              <Select 
                value={formData.type}
                onValueChange={(val: 'INCOME' | 'EXPENSE') => setFormData(prev => ({ ...prev, type: val }))}
              >
                <SelectTrigger 
                  aria-labelledby={`type-label-${rowId}`}
                  className="h-9 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  <SelectItem value="INCOME" className="text-emerald-600 font-bold">INCOME</SelectItem>
                  <SelectItem value="EXPENSE" className="text-rose-600 font-bold">EXPENSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label 
                id={`status-label-${rowId}`}
                className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider"
              >
                Status
              </label>
              <Select 
                value={formData.status || 'COMPLETED'}
                onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger 
                  aria-labelledby={`status-label-${rowId}`}
                  className="h-9 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  <SelectItem value="COMPLETED" className="text-emerald-600 font-medium">Completed</SelectItem>
                  <SelectItem value="PENDING" className="text-orange-500 font-medium">Pending</SelectItem>
                  <SelectItem value="FAILED" className="text-rose-600 font-medium">Failed</SelectItem>
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
                 onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
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
             <Button type="submit" size="sm" className="px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
               Save Changes
             </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

const ConfirmationStep = ({
  mappings,
  csvData: initialCsvData,
  onComplete,
  onBack
}: ConfirmationStepProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localCsvData, setLocalCsvData] = useState<CsvRowWrapper[]>(() => 
    initialCsvData.map((data) => ({ id: crypto.randomUUID(), data: data as any }))
  )
  const [overrides, setOverrides] = useState<Record<string, Partial<ParsedTransaction>>>({})
  const [editingRow, setEditingRow] = useState<ParsedRow | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const [bulkImportTransaction] = useBulkImportTransactionMutation()

  // Pre-compute mapped and validated transactions
  const { processedRows, validTransactions, totalErrors } = useMemo(() => {
    const rows: ParsedRow[] = []
    const valid: ParsedTransaction[] = []
    let errorCount = 0

    localCsvData.forEach((rowWrapper) => {
      const rowId = rowWrapper.id
      const rowData = rowWrapper.data
      const transaction: Record<string, any> = {}

      Object.entries(mappings).forEach(([csvColumn, transactionField]) => {
        const value = rowData[csvColumn]
        if (transactionField === 'Skip' || value === undefined) return

        if (transactionField === 'amount') {
          const cleanValue = String(value).trim()
          const lastPoint = cleanValue.lastIndexOf('.')
          const lastComma = cleanValue.lastIndexOf(',')
          const separator = lastPoint > lastComma ? '.' : ','
          
          // Split by the detected decimal separator
          const parts = cleanValue.split(separator)
          if (parts.length > 2) {
             // Multiple separators of the same type: e.g. 1.234.567 -> grouping
             transaction[transactionField] = Number(cleanValue.replace(new RegExp(`\\${separator}`, 'g'), ''))
          } else if (parts.length === 2) {
             const integerPart = parts[0].replace(/[^1234567890-]/g, '')
             const decimalPart = parts[1].replace(/[^1234567890]/g, '')
             
             // Smart Heuristic: If it's a single separator followed by exactly 3 digits, 
             // it might be a thousands separator (grouping) or a 3-digit decimal.
             // We treat it as grouping ONLY IF:
             // 1. It's a zero-decimal currency (like VND/JPY) OR
             // 2. The separator is highly likely to be grouping (this is a heuristic)
             const isProbablyGrouping = decimalPart.length === 3 && 
               (ZERO_DECIMAL_CURRENCIES.includes(transaction.currency || 'USD') || separator === (lastPoint > lastComma ? ',' : '.'))

             if (isProbablyGrouping && !cleanValue.includes(separator === '.' ? ',' : '.')) {
                // If only one type of separator exists and it looks like grouping
                transaction[transactionField] = Number(integerPart + decimalPart)
             } else {
                transaction[transactionField] = Number(integerPart + '.' + (decimalPart || '0'))
             }
          }
        } else if (transactionField === 'date') {
          transaction[transactionField] = new Date(value)
        } else if (transactionField === 'type') {
          const val = String(value).toUpperCase().trim()
          transaction[transactionField] = val.includes('INC') ? 'INCOME' : val.includes('EXP') ? 'EXPENSE' : val
        } else if (transactionField === 'currency' || transactionField === 'status') {
          transaction[transactionField] = String(value).trim().toUpperCase()
        } else {
          transaction[transactionField] = value
        }
      })

      // Apply overrides (Prioritize user edits)
      const override = overrides[rowId]
      if (override) {
        Object.assign(transaction, override)
      }

      try {
        const validated = transactionSchema.parse(transaction)
        const parsed: ParsedTransaction = {
          ...validated,
          date:
            validated.date instanceof Date && !isNaN(validated.date.getTime())
              ? validated.date.toISOString()
              : String(validated.date || new Date().toISOString()),
          isRecurring: false,
          description: (transaction.description as string) || '',
          currency: (transaction.currency as string) || CURRENCY_ENUM.USD,
          status: (transaction.status as string) || 'COMPLETED',
          category: (transaction.category as string) || 'Other'
        }
        rows.push({ id: rowId, data: parsed, isValid: true })
        valid.push(parsed)
      } catch (error) {
        errorCount++
        const message =
          error instanceof z.ZodError
            ? error.errors
                .map((e) => {
                  if (e.path[0] === 'type')
                    return 'Type: INCOME or EXPENSE'
                  if (e.path[0] === 'paymentMethod')
                    return (
                      'Payment: ' +
                      Object.values(PAYMENT_METHODS_ENUM).join(', ')
                    )
                  if (e.path[0] === 'status')
                    return 'Status: COMPLETED, PENDING, or FAILED'
                  return `${e.path[0]}: ${e.message}`
                })
                .join(' | ')
            : 'Invalid data'

        // Create a fallback data for editing even if invalid
        const fallbackData = {
          title: String(transaction.title || ''),
          amount: Number(transaction.amount || 0),
          date: (transaction.date instanceof Date && !isNaN(transaction.date.getTime())) 
            ? transaction.date.toISOString() 
            : (typeof transaction.date === 'string' && !isNaN(Date.parse(transaction.date)))
              ? new Date(transaction.date).toISOString()
              : new Date().toISOString(),
          type: (transaction.type as any) || 'EXPENSE',
          category: String(transaction.category || 'Other'),
          currency: String(transaction.currency || 'USD'),
          status: (transaction.status as string) || 'COMPLETED',
          isRecurring: false,
          description: String(transaction.description || '')
        }

        rows.push({ id: rowId, data: fallbackData, error: message, isValid: false })
      }
    })

    return { processedRows: rows, validTransactions: valid, totalErrors: errorCount }
  }, [localCsvData, mappings, overrides])

  const rowVirtualizer = useVirtualizer({
    count: processedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10
  })

  const handleImport = async () => {
    if (totalErrors > 0) {
      toast.error('Please fix all issues before importing')
      return
    }

    if (validTransactions.length > MAX_IMPORT_LIMIT) {
      toast.error(`Cannot import more than ${MAX_IMPORT_LIMIT} transactions`)
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        transactions: validTransactions as BulkTransactionType[]
      }

      await bulkImportTransaction(payload).unwrap()

      onComplete()

      toast.info('Import is being processed in the background...', {
        id: 'bulk-import',
        duration: Infinity
      })
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Failed to import transactions')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRow = (rowId: string) => {
    setLocalCsvData(prev => prev.filter((r) => r.id !== rowId))
    setOverrides(prev => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
    toast.success('Transaction row deleted')
  }

  const handleUpdateRow = (rowId: string, updatedTransaction: ParsedTransaction) => {
    setOverrides(prev => ({
      ...prev,
      [rowId]: updatedTransaction
    }))
    toast.success('Transaction updated locally')
  }

  return (
    <div className="space-y-4 flex flex-col max-h-[85vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-1">
          Confirm Import
        </DialogTitle>
        <DialogDescription>
          Review your transactions before importing
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-3">
        <div className="border rounded-lg p-3 text-xs bg-muted/20 min-w-[180px] shadow-sm">
          <h4 className="flex items-center gap-1.5 font-semibold mb-1.5 text-slate-900 dark:text-slate-100">
            <FileCheck className="w-3.5 h-3.5 text-blue-500" />
            Import Summary
          </h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Total Rows:</span>
            <span className="font-bold">{localCsvData.length}</span>
            <span className="text-muted-foreground">Ready:</span>
            <span className="text-green-600 font-bold">{validTransactions.length}</span>
          </div>
        </div>

        <div className="border rounded-lg p-3 text-xs bg-muted/20 min-w-[180px] shadow-sm">
          <h4 className="flex items-center gap-1.5 font-semibold mb-1.5 text-slate-900 dark:text-slate-100">
            {totalErrors > 0 ? <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            Validation Status
          </h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Errors:</span>
            <span className={cn("font-bold", totalErrors > 0 && "text-destructive")}>{totalErrors}</span>
            <span className="text-muted-foreground">Action:</span>
            <span className="font-bold">{totalErrors === 0 ? "Validated" : "Issues Found"}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 border rounded-xl overflow-hidden shadow-sm bg-background">
        <div 
          ref={parentRef}
          className="h-[450px] overflow-auto scrollbar-thin scrollbar-thumb-gray-200"
        >
          <Table className="table-fixed w-full border-collapse">
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 border-b">
              <TableRow className="hover:bg-transparent flex w-full h-10 px-4">
                <TableHead className="w-10 shrink-0 flex items-center justify-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider">#</TableHead>
                <TableHead className="w-[130px] shrink-0 flex items-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Date</TableHead>
                <TableHead className="flex-1 shrink-0 flex items-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider px-2">Title</TableHead>
                <TableHead className="w-[120px] shrink-0 flex items-center justify-end text-[11px] font-bold uppercase text-muted-foreground tracking-wider pr-4">Amount</TableHead>
                <TableHead className="w-[130px] shrink-0 flex items-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Category</TableHead>
                <TableHead className="w-[80px] shrink-0 flex items-center justify-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Type</TableHead>
                <TableHead className="w-[110px] shrink-0 flex items-center justify-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Status</TableHead>
                <TableHead className="w-[80px] shrink-0 flex items-center justify-end text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = processedRows[virtualRow.index]
                if (!row) return null
                
                return (
                  <TableRow
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    className={cn(
                      "absolute top-0 left-0 w-full transition-colors border-b last:border-0 flex h-12 items-center px-4",
                      !row.isValid && "bg-red-50/30 hover:bg-red-100/30"
                    )}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <TableCell className="w-10 shrink-0 flex items-center justify-center px-0">
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">{virtualRow.index + 1}</span>
                    </TableCell>
                    <TableCell className="w-[130px] shrink-0 flex items-center">
                      <span className="text-xs text-slate-500 tabular-nums truncate">
                        {row.data ? format(new Date(row.data.date), 'dd MMM, yyyy') : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="flex-1 shrink-0 flex items-center overflow-hidden px-2">
                      <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200" title={row.data?.title}>
                        {row.data?.title || '-'}
                      </span>
                    </TableCell>
                    <TableCell className={cn(
                      "w-[120px] shrink-0 flex items-center justify-end pr-4 font-bold tabular-nums text-[13px]",
                      row.data?.type === 'INCOME' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      <span className="truncate">
                        {row.data && (row.data.type === 'INCOME' ? '+ ' : '- ')}
                        {row.data && formatCurrency(row.data.amount, { 
                          currency: (row.data.currency as any) || CURRENCY_ENUM.USD,
                          showSign: false 
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="w-[130px] shrink-0 flex items-center pr-2">
                       <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0 truncate max-w-full">
                         {row.data?.category}
                       </Badge>
                    </TableCell>
                    <TableCell className="w-[80px] shrink-0 flex items-center justify-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight uppercase",
                        row.data?.type === 'INCOME' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {row.data?.type}
                      </span>
                    </TableCell>
                    <TableCell className="w-[110px] shrink-0 flex items-center justify-center px-1">
                      {!row.isValid ? (
                          <div className="group relative inline-block">
                            <Badge 
                             variant="destructive" 
                             className="h-6 text-[10px] cursor-help px-2 animate-pulse focus:ring-2 focus:ring-red-500 outline-none"
                             tabIndex={0}
                             aria-describedby={`err-${row.id}`}
                            >
                              Error
                            </Badge>
                            <div 
                              id={`err-${row.id}`}
                              role="tooltip"
                              className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-white dark:bg-gray-900 border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all z-50 pointer-events-none group-hover:pointer-events-auto scale-95 group-hover:scale-100 border-red-200"
                            >
                               <div className="flex items-center gap-2 text-red-600 font-bold mb-1 text-xs">
                                 <AlertCircle className="w-4 h-4" aria-hidden="true" />
                                 Validation Error
                               </div>
                               <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                                 {row.error}
                               </p>
                            </div>
                          </div>
                      ) : (
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white shadow-sm whitespace-nowrap",
                          row.data?.status === 'COMPLETED' ? "bg-green-500" : row.data?.status === 'FAILED' ? "bg-red-500" : "bg-orange-400"
                        )}>
                          <span className="h-1.5 w-1.5 rounded-full bg-white opacity-90" />
                          {row.data?.status === 'COMPLETED' ? 'Completed' : row.data?.status === 'FAILED' ? 'Failed' : 'Pending'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="w-[80px] shrink-0 flex items-center justify-end gap-1 px-0">
                        {row.data && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50/50"
                            onClick={() => setEditingRow(row)}
                            aria-label="Edit Transaction"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                       )}
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50/50"
                         onClick={() => handleDeleteRow(row.id)}
                         aria-label="Delete Transaction"
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                       </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-between pt-2 mt-auto">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleImport} 
          disabled={isSubmitting || totalErrors > 0}
          className={cn(totalErrors > 0 && "opacity-50 cursor-not-allowed")}
        >
          {isSubmitting ? 'Submitting...' : 'Confirm Import'}
        </Button>
      </div>

      {editingRow && editingRow.data && (
        <EditForm 
          transaction={editingRow.data} 
          index={editingRow.id} 
          onUpdate={handleUpdateRow} 
          onClose={() => setEditingRow(null)}
          open={true}
        />
      )}
    </div>
  )
}

export default ConfirmationStep

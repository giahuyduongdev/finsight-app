import { useState, useMemo, useRef, useEffect } from 'react'
import { z } from 'zod'
import {
  ChevronLeft,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format-currency'
import {
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import {
  _TRANSACTION_TYPE,
  PAYMENT_METHODS_ENUM,
  CURRENCY_ENUM,
  MAX_IMPORT_LIMIT,
  CurrencyType,
  _TransactionType
} from '@/constant'
import { toast } from 'sonner'
import { useBulkImportTransactionMutation } from '@/features/transaction/transactionAPI'
import { BulkTransactionType } from '@/features/transaction/transactionType'
import { useDispatch } from 'react-redux'
import { apiClient } from '@/app/api-client'
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
import { parseAmount } from '@/lib/amount-parser'
import { EditForm } from './edit-form'
import {
  ParsedTransaction,
  ParsedRow,
  CsvRowWrapper,
  ConfirmationStepProps
} from './types'

// Types are now imported from ./types.ts
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
  currency: z
    .string()
    .refine(
      (val) => Object.values(CURRENCY_ENUM).includes(val as CurrencyType),
      {
        message: `Invalid currency. Supported: ${Object.values(CURRENCY_ENUM).join(', ')}`
      }
    )
    .optional()
})

// ParsedRow is now imported from ./types.ts

// ─── Sub-component: Edit Form ───────────────────────────────────────────────

// EditForm has been extracted to edit-form.tsx

// ─── Component ────────────────────────────────────────────────────────────────

const ConfirmationStep = ({
  mappings,
  csvData: initialCsvData,
  onComplete,
  onBack
}: ConfirmationStepProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localCsvData, setLocalCsvData] = useState<CsvRowWrapper[]>(() =>
    initialCsvData.map((data) => ({
      id: crypto.randomUUID(),
      data: data as Record<string, string>
    }))
  )
  const [overrides, setOverrides] = useState<
    Record<string, Partial<ParsedTransaction>>
  >({})
  const [editingRow, setEditingRow] = useState<ParsedRow | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [bulkImportTransaction] = useBulkImportTransactionMutation()
  const dispatch = useDispatch()

  // Lifecycle for safety-net cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Pre-compute mapped and validated transactions
  const { processedRows, validTransactions, totalErrors } = useMemo(() => {
    const rows: ParsedRow[] = []
    const valid: ParsedTransaction[] = []
    let errorCount = 0

    localCsvData.forEach((rowWrapper) => {
      const rowId = rowWrapper.id
      const rowData = rowWrapper.data

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const draft: any = {}

      // Pass 1: Map non-amount fields (to get currency context first)
      Object.entries(mappings).forEach(([csvColumn, transactionField]) => {
        const value = rowData[csvColumn]
        if (
          transactionField === 'Skip' ||
          transactionField === 'amount' ||
          value === undefined
        )
          return

        if (transactionField === 'date') {
          const rawValue = String(value).trim()
          // Handle YYYY-MM-DD in local time to avoid UTC day-shift
          const dateMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
          if (dateMatch) {
            const y = parseInt(dateMatch[1])
            const m = parseInt(dateMatch[2])
            const d = parseInt(dateMatch[3])
            // Use Date.UTC to avoid day-shift when converting to ISOString
            draft.date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString()
          } else if (!isNaN(Date.parse(rawValue))) {
            draft.date = new Date(rawValue).toISOString()
          }
        } else if (transactionField === 'type') {
          const val = String(value).toUpperCase().trim()
          draft[transactionField] = val.includes('INC')
            ? 'INCOME'
            : val.includes('EXP')
              ? 'EXPENSE'
              : val
        } else if (
          transactionField === 'currency' ||
          transactionField === 'status'
        ) {
          draft[transactionField] = String(value).trim().toUpperCase()
        } else {
          draft[transactionField] = value
        }
      })

      // Pass 2: Map and parse amount with currency context
      const amountMapping = Object.entries(mappings).find(
        ([, field]) => field === 'amount'
      )
      if (amountMapping) {
        const [csvColumn] = amountMapping
        const value = rowData[csvColumn]
        if (value) {
          draft['amount'] = parseAmount(value, draft.currency)
        }
      }

      // Apply overrides (Prioritize user edits)
      const override = overrides[rowId]
      if (override) {
        Object.assign(draft, override)
      }

      try {
        const validated = transactionSchema.parse({
          ...draft,
          date: draft.date ? new Date(draft.date) : undefined
        })
        const parsed: ParsedTransaction = {
          title: validated.title,
          amount: validated.amount,
          date:
            validated.date instanceof Date && !isNaN(validated.date.getTime())
              ? validated.date.toISOString()
              : String(validated.date || new Date().toISOString()),
          type: validated.type as 'INCOME' | 'EXPENSE',
          category: validated.category,
          paymentMethod: (validated.paymentMethod as string) || undefined,
          status: (validated.status as string) || 'COMPLETED',
          isRecurring: false,
          description: (draft.description as string) || '',
          currency: (validated.currency as string) || CURRENCY_ENUM.USD
        }
        rows.push({ id: rowId, data: parsed, isValid: true })
        valid.push(parsed)
      } catch (error) {
        errorCount++
        const message =
          error instanceof z.ZodError
            ? error.errors
                .map((e) => {
                  if (e.path[0] === 'type') return 'Type: INCOME or EXPENSE'
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
          title: String(draft.title || ''),
          amount: Number(draft.amount || 0),
          date:
            typeof draft.date === 'string' && !isNaN(Date.parse(draft.date))
              ? new Date(draft.date).toISOString()
              : '', // Don't default to today, keep it empty to force a fix
          type: (draft.type as _TransactionType) || 'EXPENSE',
          category: String(draft.category || 'Other'),
          currency: String(draft.currency || 'USD'),
          status: (draft.status as string) || undefined,
          isRecurring: false,
          description: String(draft.description || '')
        }

        rows.push({
          id: rowId,
          data: fallbackData,
          error: message,
          isValid: false
        })
      }
    })

    return {
      processedRows: rows,
      validTransactions: valid,
      totalErrors: errorCount
    }
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
    let importCompleted = false // Flag to prevent race condition

    try {
      const payload = {
        transactions: validTransactions as BulkTransactionType[]
      }

      await bulkImportTransaction(payload).unwrap()

      // Mark as completed before closing modal
      importCompleted = true

      // Close modal immediately and let background handle it
      onComplete()

      toast.info('Import processing in background', {
        id: 'bulk-import',
        duration: 3000
      })

      // Safety net: Invalidate tags after a longer delay (5s) for large imports
      // Only if import was completed successfully
      timerRef.current = setTimeout(() => {
        if (importCompleted) {
          dispatch(apiClient.util.invalidateTags(['transactions', 'analytics']))
        }
      }, 5000)
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Failed to import transactions')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRow = (rowId: string) => {
    setLocalCsvData((prev) => prev.filter((r) => r.id !== rowId))
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
    toast.success('Transaction row deleted')
  }

  const handleUpdateRow = (
    rowId: string,
    updatedTransaction: ParsedTransaction
  ) => {
    setOverrides((prev) => ({
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
            <span className="text-green-600 font-bold">
              {validTransactions.length}
            </span>
          </div>
        </div>

        <div className="border rounded-lg p-3 text-xs bg-muted/20 min-w-[180px] shadow-sm">
          <h4 className="flex items-center gap-1.5 font-semibold mb-1.5 text-slate-900 dark:text-slate-100">
            {totalErrors > 0 ? (
              <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            )}
            Validation Status
          </h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Errors:</span>
            <span
              className={cn('font-bold', totalErrors > 0 && 'text-destructive')}
            >
              {totalErrors}
            </span>
            <span className="text-muted-foreground">Action:</span>
            <span className="font-bold">
              {totalErrors === 0 ? 'Validated' : 'Issues Found'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[260px] border rounded-xl overflow-hidden shadow-sm bg-background">
        <div
          ref={parentRef}
          className="h-[min(450px,calc(85vh-260px))] overflow-auto scrollbar-thin scrollbar-thumb-gray-200"
        >
          <Table className="table-fixed w-full border-collapse" role="grid">
            <TableHeader
              className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 border-b"
              role="rowgroup"
            >
              <TableRow
                className="hover:bg-transparent flex w-full h-10 px-4"
                role="row"
              >
                <TableHead
                  className="w-10 shrink-0 flex items-center justify-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider"
                  role="columnheader"
                >
                  #
                </TableHead>
                <TableHead
                  className="w-[130px] shrink-0 flex items-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider"
                  role="columnheader"
                >
                  Date
                </TableHead>
                <TableHead
                  className="flex-1 shrink-0 flex items-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider px-2"
                  role="columnheader"
                >
                  Title
                </TableHead>
                <TableHead
                  className="w-[120px] shrink-0 flex items-center justify-end text-[11px] font-bold uppercase text-muted-foreground tracking-wider pr-4"
                  role="columnheader"
                >
                  Amount
                </TableHead>
                <TableHead
                  className="w-[130px] shrink-0 flex items-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider"
                  role="columnheader"
                >
                  Category
                </TableHead>
                <TableHead
                  className="w-[80px] shrink-0 flex items-center justify-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider"
                  role="columnheader"
                >
                  Type
                </TableHead>
                <TableHead
                  className="w-[110px] shrink-0 flex items-center justify-center text-[11px] font-bold uppercase text-muted-foreground tracking-wider"
                  role="columnheader"
                >
                  Status
                </TableHead>
                <TableHead
                  className="w-[80px] shrink-0 flex items-center justify-end text-[11px] font-bold uppercase text-muted-foreground tracking-wider"
                  role="columnheader"
                >
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative'
              }}
              role="rowgroup"
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = processedRows[virtualRow.index]
                if (!row) return null

                return (
                  <TableRow
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    role="row"
                    className={cn(
                      'absolute top-0 left-0 w-full transition-colors border-b last:border-0 flex h-12 items-center px-4',
                      !row.isValid && 'bg-red-50/30 hover:bg-red-100/30'
                    )}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <TableCell
                      className="w-10 shrink-0 flex items-center justify-center px-0"
                      role="gridcell"
                    >
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                        {virtualRow.index + 1}
                      </span>
                    </TableCell>
                    <TableCell
                      className="w-[130px] shrink-0 flex items-center"
                      role="gridcell"
                    >
                      <span className="text-xs text-slate-500 tabular-nums truncate">
                        {row.data?.date &&
                        !isNaN(new Date(row.data.date).getTime())
                          ? format(new Date(row.data.date), 'dd MMM, yyyy')
                          : '-'}
                      </span>
                    </TableCell>
                    <TableCell
                      className="flex-1 shrink-0 flex items-center overflow-hidden px-2"
                      role="gridcell"
                    >
                      <span
                        className="text-sm font-medium truncate text-slate-700 dark:text-slate-200"
                        title={row.data?.title}
                      >
                        {row.data?.title || '-'}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'w-[120px] shrink-0 flex items-center justify-end pr-4 font-bold tabular-nums text-[13px]',
                        row.data?.type === 'INCOME'
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      )}
                      role="gridcell"
                    >
                      <span className="truncate">
                        {row.data && (row.data.type === 'INCOME' ? '+ ' : '- ')}
                        {row.data &&
                          formatCurrency(row.data.amount, {
                            currency:
                              (row.data.currency as CurrencyType) ||
                              CURRENCY_ENUM.USD,
                            showSign: false
                          })}
                      </span>
                    </TableCell>
                    <TableCell
                      className="w-[130px] shrink-0 flex items-center pr-2"
                      role="gridcell"
                    >
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium px-2 py-0 truncate max-w-full"
                      >
                        {row.data?.category}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="w-[80px] shrink-0 flex items-center justify-center"
                      role="gridcell"
                    >
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight uppercase',
                          row.data?.type === 'INCOME'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        )}
                      >
                        {row.data?.type}
                      </span>
                    </TableCell>
                    <TableCell
                      className="w-[110px] shrink-0 flex items-center justify-center px-1"
                      role="gridcell"
                    >
                      {!row.isValid ? (
                        <div className="group relative inline-block focus-within:z-50">
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
                            className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-white dark:bg-gray-900 border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all z-[100] pointer-events-none group-hover:pointer-events-auto scale-95 group-hover:scale-100 border-red-200"
                          >
                            <div className="flex items-center gap-2 text-red-600 font-bold mb-1 text-xs">
                              <AlertCircle
                                className="w-4 h-4"
                                aria-hidden="true"
                              />
                              Validation Error
                            </div>
                            <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                              {row.error}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white shadow-sm whitespace-nowrap',
                            row.data?.status === 'COMPLETED'
                              ? 'bg-green-500'
                              : row.data?.status === 'FAILED'
                                ? 'bg-red-500'
                                : 'bg-orange-400'
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white opacity-90" />
                          {row.data?.status === 'COMPLETED'
                            ? 'Completed'
                            : row.data?.status === 'FAILED'
                              ? 'Failed'
                              : 'Pending'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className="w-[80px] shrink-0 flex items-center justify-end gap-1 px-0"
                      role="gridcell"
                    >
                      {row.data && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50/50"
                          onClick={() => setEditingRow(row)}
                          aria-label={`Edit transaction ${virtualRow.index + 1}: ${row.data?.title || 'Untitled'}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50/50"
                        onClick={() => handleDeleteRow(row.id)}
                        aria-label={`Delete transaction ${virtualRow.index + 1}: ${row.data?.title || 'Untitled'}`}
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
          className={cn(totalErrors > 0 && 'opacity-50 cursor-not-allowed')}
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

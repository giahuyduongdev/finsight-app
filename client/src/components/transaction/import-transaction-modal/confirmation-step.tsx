import { useState, useMemo, useRef } from 'react'
import { z } from 'zod'
import { ChevronLeft, FileCheck, AlertCircle, CheckCircle2, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format-currency'
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

type CsvRow = Record<string, string | undefined>

type ConfirmationStepProps = {
  file: File | null
  mappings: Record<string, string>
  csvData: CsvRow[]
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
  currency: z.string().optional()
})

type ParsedRow = {
  index: number
  data: ParsedTransaction | null
  error?: string
  isValid: boolean
}

// ─── Sub-component: Edit Form ───────────────────────────────────────────────

const EditForm = ({ transaction, index, onUpdate, onClose, open }: {
  transaction: ParsedTransaction
  index: number
  onUpdate: (index: number, data: ParsedTransaction) => void
  onClose: () => void
  open: boolean
}) => {
  const [formData, setFormData] = useState<ParsedTransaction>({ ...transaction })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate(index, formData)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px] z-[150]">
        <DialogHeader>
          <DialogTitle>Edit Transaction #{index}</DialogTitle>
          <DialogDescription>
            Make changes to your transaction details here.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Title</label>
            <Input 
              value={formData.title}
              className="h-9 text-sm"
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Amount</label>
              <CurrencyInputField 
                name={`amount-edit-${index}`}
                value={String(formData.amount)}
                prefix={CURRENCY_SYMBOLS[formData.currency as CurrencyType] || '$'}
                decimalsLimit={formData.currency === 'VND' ? 0 : 2}
                className="h-9 text-sm"
                onValueChange={(val) => setFormData(prev => ({ ...prev, amount: Number(val || 0) }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Currency</label>
              <Select 
                value={formData.currency || CURRENCY_ENUM.USD}
                onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
              >
                <SelectTrigger className="h-9 text-sm">
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
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Type</label>
              <Select 
                value={formData.type}
                onValueChange={(val) => setFormData(prev => ({ ...prev, type: val as any }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  <SelectItem value="INCOME" className="text-emerald-600 font-bold">INCOME</SelectItem>
                  <SelectItem value="EXPENSE" className="text-rose-600 font-bold">EXPENSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Status</label>
              <Select 
                value={formData.status || 'COMPLETED'}
                onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger className="h-9 text-sm">
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

          <div className="space-y-1.5">
             <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Category</label>
             <Input 
               value={formData.category}
               className="h-9 text-sm"
               onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
             />
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
  const [localCsvData, setLocalCsvData] = useState<CsvRow[]>(initialCsvData)
  const [overrides, setOverrides] = useState<Record<number, Partial<ParsedTransaction>>>({})
  const [editingRow, setEditingRow] = useState<ParsedRow | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const [bulkImportTransaction] = useBulkImportTransactionMutation()

  // Pre-compute mapped and validated transactions
  const { processedRows, validTransactions, totalErrors } = useMemo(() => {
    const rows: ParsedRow[] = []
    const valid: ParsedTransaction[] = []
    let errorCount = 0

    localCsvData.forEach((row, index) => {
      const transaction: Record<string, any> = {}
      const rowIndex = index + 1

      Object.entries(mappings).forEach(([csvColumn, transactionField]) => {
        const value = row[csvColumn]
        if (transactionField === 'Skip' || value === undefined) return

        if (transactionField === 'amount') {
          transaction[transactionField] = Number(String(value).replace(/[^0-9.-]+/g,""))
        } else if (transactionField === 'date') {
          transaction[transactionField] = new Date(value)
        } else if (transactionField === 'type') {
          const val = String(value).toUpperCase().trim()
          transaction[transactionField] = val.includes('INC') ? 'INCOME' : val.includes('EXP') ? 'EXPENSE' : val
        } else {
          transaction[transactionField] = value
        }
      })

      // Apply overrides (Prioritize user edits)
      const override = overrides[rowIndex]
      if (override) {
        Object.assign(transaction, override)
      }

      try {
        const validated = transactionSchema.parse(transaction)
        const parsed: ParsedTransaction = {
          ...validated,
          date:
            validated.date instanceof Date
              ? validated.date.toISOString()
              : validated.date,
          isRecurring: false,
          description: (transaction.description as string) || '',
          currency: (transaction.currency as string) || CURRENCY_ENUM.USD,
          status: (transaction.status as string) || 'COMPLETED',
          category: (transaction.category as string) || 'Other'
        }
        rows.push({ index: rowIndex, data: parsed, isValid: true })
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
          date: transaction.date instanceof Date ? transaction.date.toISOString() : String(transaction.date || new Date().toISOString()),
          type: (transaction.type as any) || 'EXPENSE',
          category: String(transaction.category || 'Other'),
          currency: String(transaction.currency || 'USD'),
          status: (transaction.status as string) || 'COMPLETED',
          isRecurring: false,
          description: String(transaction.description || '')
        }

        rows.push({ index: rowIndex, data: fallbackData, error: message, isValid: false })
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

  const handleDeleteRow = (index: number) => {
    setLocalCsvData(prev => prev.filter((_, i) => (i + 1) !== index))
    setOverrides(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    toast.success('Transaction row deleted')
  }

  const handleUpdateRow = (index: number, updatedTransaction: ParsedTransaction) => {
    setOverrides(prev => ({
      ...prev,
      [index]: updatedTransaction
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
            <TableHeader className="sticky top-0 bg-secondary/30 backdrop-blur-md z-50">
              <TableRow className="hover:bg-transparent border-b flex w-full">
                <TableHead className="w-12 shrink-0 flex items-center justify-center font-semibold text-foreground text-[13px]">#</TableHead>
                <TableHead className="w-[120px] shrink-0 flex items-center font-semibold text-foreground text-[13px]">Date</TableHead>
                <TableHead className="flex-1 shrink-0 flex items-center font-semibold text-foreground text-[13px]">Title</TableHead>
                <TableHead className="w-[130px] shrink-0 flex items-center font-semibold text-foreground text-[13px]">Amount</TableHead>
                <TableHead className="w-[140px] shrink-0 flex items-center font-semibold text-foreground text-[13px]">Category</TableHead>
                <TableHead className="w-[80px] shrink-0 flex items-center font-semibold text-foreground text-[13px]">Type</TableHead>
                <TableHead className="w-[110px] shrink-0 flex items-center justify-center font-semibold text-foreground text-[13px]">Status</TableHead>
                <TableHead className="w-[100px] shrink-0 flex items-center justify-end font-semibold text-foreground text-[13px] pr-4">Actions</TableHead>
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
                      "absolute top-0 left-0 w-full transition-colors border-b last:border-0 flex h-12 items-center",
                      !row.isValid && "bg-red-50/30 hover:bg-red-100/30"
                    )}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <TableCell className="w-12 shrink-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">{row.index}</span>
                    </TableCell>
                    <TableCell className="w-[120px] shrink-0 flex items-center pr-2">
                      <span className="text-xs text-slate-500 tabular-nums truncate" title={row.data ? format(new Date(row.data.date), 'dd MMM, yyyy') : '-'}>
                        {row.data ? format(new Date(row.data.date), 'dd MMM, yyyy') : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="flex-1 shrink-0 flex items-center overflow-hidden pr-4">
                      <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200" title={row.data?.title}>
                        {row.data?.title || '-'}
                      </span>
                    </TableCell>
                    <TableCell className={cn(
                      "w-[130px] shrink-0 flex items-center font-medium tabular-nums text-[13px]",
                      row.data?.type === 'INCOME' ? "text-green-600" : "text-destructive"
                    )}>
                      <span className="truncate">
                        {row.data && (row.data.type === 'INCOME' ? '+' : '-')}
                        {row.data && formatCurrency(row.data.amount, { currency: (row.data.currency as any) || CURRENCY_ENUM.USD })}
                      </span>
                    </TableCell>
                    <TableCell className="w-[140px] shrink-0 flex items-center pr-2">
                       <Badge variant="outline" className="bg-muted/50 text-[10px] font-medium px-2 py-0 truncate max-w-full">
                         {row.data?.category}
                       </Badge>
                    </TableCell>
                    <TableCell className="w-[80px] shrink-0 flex items-center px-1">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide capitalize",
                        row.data?.type === 'INCOME' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      )}>
                        {row.data?.type.toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell className="w-[110px] shrink-0 flex items-center justify-center px-1">
                      {!row.isValid ? (
                         <div className="group relative inline-block">
                           <Badge variant="destructive" className="h-6 text-[10px] cursor-help px-2 animate-pulse">
                             Error
                           </Badge>
                           <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-white dark:bg-gray-900 border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all z-50 pointer-events-none scale-95 group-hover:scale-100 border-red-200">
                              <div className="flex items-center gap-2 text-red-600 font-bold mb-1 text-xs">
                                <AlertCircle className="w-4 h-4" />
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
                          row.data?.status === 'COMPLETED' ? "bg-green-500" : "bg-orange-400"
                        )}>
                          <span className="h-1.5 w-1.5 rounded-full bg-white opacity-90" />
                          {row.data?.status === 'COMPLETED' ? 'Completed' : 'Pending'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="w-[100px] shrink-0 flex items-center justify-end gap-0.5 pr-4">
                        {row.data && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => setEditingRow(row)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                       )}
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                         onClick={() => handleDeleteRow(row.index)}
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

      {editingRow && (
        <EditForm 
          transaction={editingRow.data!} 
          index={editingRow.index} 
          onUpdate={handleUpdateRow} 
          onClose={() => setEditingRow(null)}
          open={true}
        />
      )}
    </div>
  )
}

export default ConfirmationStep

import { useState } from 'react'
import { z } from 'zod'
import { ChevronDown, ChevronLeft, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { _TRANSACTION_TYPE, PAYMENT_METHODS_ENUM } from '@/constant'
import { toast } from 'sonner'
import { MAX_IMPORT_LIMIT } from '@/constant'
import { BulkTransactionType } from '@/features/transaction/transationType'
import { useBulkImportTransactionMutation } from '@/features/transaction/transactionAPI'

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
    .optional()
})

// ─── Component ────────────────────────────────────────────────────────────────

const ConfirmationStep = ({
  file,
  mappings,
  csvData,
  onComplete,
  onBack
}: ConfirmationStepProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [bulkImportTransaction] = useBulkImportTransactionMutation()

  const getAssignFieldToMappedTransactions = () => {
    let hasValidationErrors = false
    const results: ParsedTransaction[] = []

    csvData.forEach((row, index) => {
      const transaction: Record<string, string | number | Date> = {}

      Object.entries(mappings).forEach(([csvColumn, transactionField]) => {
        const value = row[csvColumn]
        if (transactionField === 'Skip' || value === undefined) return

        if (transactionField === 'amount') {
          transaction[transactionField] = Number(value)
        } else if (transactionField === 'date') {
          transaction[transactionField] = new Date(value)
        } else {
          transaction[transactionField] = value
        }
      })

      try {
        const validated = transactionSchema.parse(transaction)
        results.push({
          ...validated,
          // 👇 Convert Date → ISO string
          date:
            validated.date instanceof Date
              ? validated.date.toISOString()
              : validated.date,
          isRecurring: false,
          description: ''
        })
      } catch (error) {
        hasValidationErrors = true
        const message =
          error instanceof z.ZodError
            ? error.errors
                .map((e) => {
                  if (e.path[0] === 'type')
                    return 'Transaction type:- must be INCOME or EXPENSE'
                  if (e.path[0] === 'paymentMethod')
                    return (
                      'Payment method:- must be one of: ' +
                      Object.values(PAYMENT_METHODS_ENUM).join(', ')
                    )
                  if (e.path[0] === 'status')
                    return 'Status:- must be COMPLETED, PENDING, or FAILED'
                  return `${e.path[0]}: ${e.message}`
                })
                .join('\n')
            : 'Invalid data'

        setErrors((prev) => ({ ...prev, [index + 1]: message }))
      }
    })

    return { transactions: results, hasValidationErrors }
  }

  const handleImport = async () => {
    const { transactions, hasValidationErrors } =
      getAssignFieldToMappedTransactions()

    if (hasErrors || hasValidationErrors) return

    if (transactions.length > MAX_IMPORT_LIMIT) {
      toast.error(`Cannot import more than ${MAX_IMPORT_LIMIT} transactions`)
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        transactions: transactions as BulkTransactionType[]
      }

      await bulkImportTransaction(payload).unwrap()

      // Đóng modal ngay
      onComplete()

      // Toast thông báo đang xử lý ở background
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

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-1">
          Confirm Import
        </DialogTitle>
        <DialogDescription>
          Review your settings before importing
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="border rounded-md p-4 w-full">
          <h4 className="flex items-center gap-1 font-medium mb-2">
            <FileCheck className="w-4 h-4" />
            Import Summary
          </h4>
          <div className="grid grid-cols-2 w-full gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">File</p>
              <p>{file?.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Columns Mapped</p>
              <p>{Object.keys(mappings).length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Transactions</p>
              <p>{csvData.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Transactions Limit</p>
              <p>{MAX_IMPORT_LIMIT}</p>
            </div>
          </div>
        </div>

        {hasErrors && (
          <div
            className="w-full block border border-red-100 bg-[#fef2f2] dark:bg-background rounded text-sm overflow-y-auto"
            style={{ maxHeight: '250px' }}
          >
            <p className="font-medium mb-2 bg-[#fef2f2] dark:bg-background sticky top-0 px-2 py-1">
              Issues found:
            </p>
            <div className="space-y-1 p-2">
              {Object.entries(errors).map(([row, msg]) => (
                <details key={row} className="group">
                  <summary className="flex text-sm items-center justify-between cursor-pointer !text-red-600">
                    <span>Row {row}</span>
                    <ChevronDown className="w-4 h-4 transform group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-1 pl-2 text-xs !text-red-500 border-l-2 border-red-200">
                    {msg.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleImport} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Confirm Import'}
        </Button>
      </div>
    </div>
  )
}

export default ConfirmationStep

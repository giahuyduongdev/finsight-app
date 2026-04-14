import * as z from 'zod'
import { useState } from 'react'
import { Calendar, Loader } from 'lucide-react'
import { useForm, Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import RecieptScanner from './reciept-scanner'
import {
  _TRANSACTION_FREQUENCY,
  _TRANSACTION_TYPE,
  CATEGORIES,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  PAYMENT_METHODS,
  CurrencyType
} from '@/constant'
import { Switch } from '../ui/switch'
import CurrencyInputField from '../ui/currency-input'
import { SingleSelector } from '../ui/single-select'
import { AIScanReceiptData } from '@/features/transaction/transationType'
import {
  useCreateTransactionMutation,
  useGetSingleTransactionQuery,
  useUpdateTransactionMutation
} from '@/features/transaction/transactionAPI'
import { toast } from 'sonner'

const formSchema = z.object({
  title: z.string().min(2, { message: 'Title must be at least 2 characters.' }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount must be a positive number.'
  }),
  currency: z.string().default('USD'),
  type: z.enum([_TRANSACTION_TYPE.INCOME, _TRANSACTION_TYPE.EXPENSE]),
  category: z.string().min(1, { message: 'Please select a category.' }),
  date: z.date({
    required_error: 'Please select a date.'
  }),
  paymentMethod: z
    .string()
    .min(1, { message: 'Please select a payment method.' }),
  status: z.enum(['COMPLETED', 'PENDING', 'FAILED']).default('COMPLETED'),
  isRecurring: z.boolean(),
  frequency: z
    .enum([
      _TRANSACTION_FREQUENCY.DAILY,
      _TRANSACTION_FREQUENCY.WEEKLY,
      _TRANSACTION_FREQUENCY.MONTHLY,
      _TRANSACTION_FREQUENCY.YEARLY
    ])
    .nullable()
    .optional(),
  description: z.string().optional(),
  receiptUrl: z.string().optional()
})

type FormValues = z.infer<typeof formSchema>

const TransactionForm = (props: {
  isEdit?: boolean
  transactionId?: string
  onCloseDrawer?: () => void
}) => {
  const { onCloseDrawer, isEdit = false, transactionId } = props

  const [isScanning, setIsScanning] = useState(false)

  const { data, isLoading } = useGetSingleTransactionQuery(
    transactionId || '',
    { skip: !transactionId }
  )
  const editData = data?.transaction

  // Kiểm tra xem đây có phải là giao dịch con không (dựa vào DB)
  const isChildTransaction = !!editData?.recurringSourceId

  const [createTransaction, { isLoading: isCreating }] =
    useCreateTransactionMutation()

  const [updateTransaction, { isLoading: isUpdating }] =
    useUpdateTransactionMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      title: '',
      amount: '',
      currency: 'USD',
      type: _TRANSACTION_TYPE.INCOME,
      category: '',
      date: new Date(),
      paymentMethod: '',
      status: 'COMPLETED',
      isRecurring: false,
      frequency: null,
      description: '',
      receiptUrl: ''
    },
    values:
      isEdit && editData
        ? {
            title: editData.title || '',
            amount: editData.amount ? editData.amount.toString() : '',
            currency: editData.currency || 'USD',
            type: editData.type || _TRANSACTION_TYPE.INCOME,
            category: editData.category?.toLowerCase() || '',
            date: editData.date ? new Date(editData.date) : new Date(),
            paymentMethod: editData.paymentMethod || '',
            status:
              (editData.status as 'COMPLETED' | 'PENDING' | 'FAILED') ||
              'COMPLETED',
            isRecurring: editData.isRecurring || false,
            frequency: editData.recurringInterval || null,
            description: editData.description || ''
          }
        : undefined
  })

  const frequencyOptions = Object.entries(_TRANSACTION_FREQUENCY).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ([_, value]) => ({
      value: value,
      label: value.replace('_', ' ').toLowerCase()
    })
  )

  const handleScanComplete = (data: AIScanReceiptData) => {
    form.reset({
      ...form.getValues(),
      title: data.title || '',
      amount: data.amount.toString(),
      currency: data.currency || 'USD',
      type: data.type || _TRANSACTION_TYPE.EXPENSE,
      category: data.category?.toLowerCase() || '',
      date: new Date(data.date),
      paymentMethod: data.paymentMethod || '',
      status: 'COMPLETED',
      isRecurring: false,
      frequency: null,
      description: data.description || '',
      receiptUrl: data.receiptUrl || ''
    })
  }

  const onSubmit = (values: FormValues) => {
    const payload = {
      title: values.title,
      type: values.type,
      category: values.category,
      paymentMethod: values.paymentMethod,
      status: values.status,
      description: values.description || '',
      amount: Number(values.amount),
      currency: values.currency as CurrencyType,
      date: values.date.toISOString(),
      isRecurring: values.isRecurring || false,
      recurringInterval: values.frequency || null
    }
    if (isEdit && transactionId) {
      updateTransaction({ id: transactionId, transaction: payload })
        .unwrap()
        .then(() => {
          onCloseDrawer?.()
          toast.success('Transaction updated successfully')
        })
        .catch((error) => {
          toast.error(error.data.message || 'Failed to update transaction')
        })
      return
    }
    createTransaction(payload)
      .unwrap()
      .then(() => {
        form.reset()
        onCloseDrawer?.()
        toast.success('Transaction created successfully')
      })
      .catch((error) => {
        toast.error(error.data.message || 'Failed to create transaction')
      })
  }

  return (
    <div className="relative pb-10 pt-5 px-2.5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4">
          <div className="space-y-6">
            {!isEdit && (
              <RecieptScanner
                loadingChange={isScanning}
                onLoadingChange={setIsScanning}
                onScanComplete={handleScanComplete}
              />
            )}

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Transaction Type</FormLabel>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className={cn(
                      'flex space-x-2',
                      (isScanning || isChildTransaction) && 'opacity-60'
                    )}
                    // 👇 ĐÃ KHÓA: Nếu là giao dịch con thì không cho đổi Thu/Chi
                    disabled={isScanning || isChildTransaction}
                  >
                    <label
                      htmlFor={_TRANSACTION_TYPE.INCOME}
                      className={cn(
                        `text-sm font-normal leading-none
                        flex items-center space-x-2 rounded-md 
                        shadow-sm border p-2 flex-1 justify-center 
                        `,
                        field.value === _TRANSACTION_TYPE.INCOME &&
                          '!border-primary',
                        isScanning || isChildTransaction
                          ? 'cursor-not-allowed'
                          : 'cursor-pointer'
                      )}
                    >
                      <RadioGroupItem
                        value={_TRANSACTION_TYPE.INCOME}
                        id={_TRANSACTION_TYPE.INCOME}
                        className="!border-primary"
                      />
                      Income
                    </label>

                    <label
                      htmlFor={_TRANSACTION_TYPE.EXPENSE}
                      className={cn(
                        `text-sm font-normal leading-none
                        flex items-center space-x-2 rounded-md 
                        shadow-sm border p-2 flex-1 justify-center 
                        `,
                        field.value === _TRANSACTION_TYPE.EXPENSE &&
                          '!border-primary',
                        isScanning || isChildTransaction
                          ? 'cursor-not-allowed'
                          : 'cursor-pointer'
                      )}
                    >
                      <RadioGroupItem
                        value={_TRANSACTION_TYPE.EXPENSE}
                        id={_TRANSACTION_TYPE.EXPENSE}
                        className="!border-primary"
                      />
                      Expense
                    </label>
                  </RadioGroup>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="!font-normal">Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Transaction title"
                      {...field}
                      disabled={isScanning}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-row items-start gap-2 w-full">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="flex-1 space-y-1">
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <CurrencyInputField
                        {...field}
                        disabled={isScanning}
                        onValueChange={(value) => field.onChange(value || '')}
                        placeholder="0.00"
                        prefix={
                          CURRENCY_SYMBOLS[
                            form.watch(
                              'currency'
                            ) as keyof typeof CURRENCY_SYMBOLS
                          ] || '$'
                        }
                        decimalsLimit={form.watch('currency') === 'VND' ? 0 : 2}
                        className="h-10 w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="space-y-1 flex-shrink-0">
                    <FormLabel className="text-transparent select-none">
                      Currency
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      // 👇 ĐÃ KHÓA: Nếu là giao dịch con thì không cho đổi Tiền tệ
                      disabled={isScanning || isChildTransaction}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 w-[80px] bg-muted/50 font-bold uppercase focus:ring-0">
                          <SelectValue placeholder="USD" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <SingleSelector
                    value={
                      CATEGORIES.find((opt) => opt.value === field.value) ||
                      field.value
                        ? { value: field.value, label: field.value }
                        : undefined
                    }
                    onChange={(option) => field.onChange(option.value)}
                    options={CATEGORIES}
                    placeholder="Select or type a category"
                    creatable
                    disabled={isScanning}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover modal={false}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal h-10',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <Calendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 !pointer-events-auto"
                      align="start"
                    >
                      <CalendarComponent
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date)
                        }}
                        disabled={(date) => date < new Date('2023-01-01')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                    disabled={isScanning}
                  >
                    <FormControl className="w-full">
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <div
                      className={cn(
                        'grid gap-2',
                        isEdit ? 'grid-cols-3' : 'grid-cols-2'
                      )}
                    >
                      <label
                        className={cn(
                          'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 transition-colors hover:bg-muted',
                          field.value === 'COMPLETED'
                            ? 'border-green-500 bg-green-50/50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                            : 'border-input text-muted-foreground'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                            field.value === 'COMPLETED'
                              ? 'border-green-500'
                              : 'border-primary/50'
                          )}
                        >
                          {field.value === 'COMPLETED' && (
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                          )}
                        </div>
                        <span className="text-[12.5px] font-medium whitespace-nowrap">
                          Completed
                        </span>
                        <input
                          type="radio"
                          className="hidden"
                          value="COMPLETED"
                          checked={field.value === 'COMPLETED'}
                          onChange={() => field.onChange('COMPLETED')}
                        />
                      </label>

                      <label
                        className={cn(
                          'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 transition-colors hover:bg-muted',
                          field.value === 'PENDING'
                            ? 'border-yellow-500 bg-yellow-50/50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-500'
                            : 'border-input text-muted-foreground'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                            field.value === 'PENDING'
                              ? 'border-yellow-500'
                              : 'border-primary/50'
                          )}
                        >
                          {field.value === 'PENDING' && (
                            <div className="h-2 w-2 rounded-full bg-yellow-500" />
                          )}
                        </div>
                        <span className="text-[12.5px] font-medium whitespace-nowrap">
                          Pending
                        </span>
                        <input
                          type="radio"
                          className="hidden"
                          value="PENDING"
                          checked={field.value === 'PENDING'}
                          onChange={() => field.onChange('PENDING')}
                        />
                      </label>

                      {isEdit && (
                        <label
                          className={cn(
                            'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 transition-colors hover:bg-muted',
                            field.value === 'FAILED'
                              ? 'border-red-500 bg-red-50/50 text-red-700 dark:bg-red-950/20 dark:text-red-500'
                              : 'border-input text-muted-foreground'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                              field.value === 'FAILED'
                                ? 'border-red-500'
                                : 'border-primary/50'
                            )}
                          >
                            {field.value === 'FAILED' && (
                              <div className="h-2 w-2 rounded-full bg-red-500" />
                            )}
                          </div>
                          <span className="text-[12.5px] font-medium whitespace-nowrap">
                            Failed
                          </span>
                          <input
                            type="radio"
                            className="hidden"
                            value="FAILED"
                            checked={field.value === 'FAILED'}
                            onChange={() => field.onChange('FAILED')}
                          />
                        </label>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-[14.5px]">
                      Recurring Transaction
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      {isChildTransaction
                        ? 'Child transactions cannot be made recurring'
                        : field.value
                          ? 'This will repeat automatically'
                          : 'Set recurring to repeat this transaction'}
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      disabled={isScanning || isChildTransaction}
                      checked={field.value}
                      className={
                        isChildTransaction
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer'
                      }
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        if (checked) {
                          form.setValue(
                            'frequency',
                            _TRANSACTION_FREQUENCY.DAILY
                          )
                        } else {
                          form.setValue('frequency', null)
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('isRecurring') && form.getValues().isRecurring && (
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem className="recurring-control">
                    <FormLabel>Frequency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={isScanning}
                    >
                      <FormControl className="w-full">
                        <SelectTrigger className="h-10">
                          <SelectValue
                            placeholder="Select frequency"
                            className="!capitalize"
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {frequencyOptions.map(({ value, label }) => (
                          <SelectItem
                            key={value}
                            value={value}
                            className="!capitalize"
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add notes about this transaction"
                      className="resize-none"
                      disabled={isScanning}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="sticky bottom-0 bg-white dark:bg-background pb-2">
            <Button
              type="submit"
              className="w-full !text-white h-10"
              disabled={isScanning || isCreating || isUpdating}
            >
              {isCreating || isUpdating ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : null}
              {isEdit ? 'Update' : 'Save'}
            </Button>
          </div>

          {isLoading && (
            <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/70 dark:bg-background/70 z-50 flex justify-center">
              <Loader className="h-8 w-8 animate-spin" />
            </div>
          )}
        </form>
      </Form>
    </div>
  )
}

export default TransactionForm

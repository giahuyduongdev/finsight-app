import {
  ArrowUpDown,
  ChevronRight,
  CircleDot,
  LucideIcon,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { TransactionType } from '@/features/transaction/transationType'
import {
  _TRANSACTION_FREQUENCY,
  _TRANSACTION_TYPE,
  CURRENCY_ENUM,
  CURRENCY_SYMBOLS,
  CurrencyType
} from '@/constant'
import { formatCurrency } from '@/lib/format-currency'
import ActionsCell from './actions-cell'

export type DisplayTransaction = TransactionType & {
  _rowType?: 'child' | 'upcoming'
}

type FrequencyInfo = { label: string; icon: LucideIcon }
type FrequencyMapType = { [key: string]: FrequencyInfo; DEFAULT: FrequencyInfo }

export const createTransactionColumns = (
  expandedRows: Set<string>,
  onExpandRow: (id: string) => void
): ColumnDef<DisplayTransaction>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="w-[24px] flex justify-center">
        <Checkbox
          className="!border-black data-[state=checked]:!bg-gray-800 !text-white h-4 w-4"
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => {
      if (row.original._rowType) return <div className="w-[24px]" />
      return (
        <div className="w-[24px] flex justify-center">
          <Checkbox
            className="!border-black data-[state=checked]:!bg-gray-800 !text-white h-4 w-4"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false
  },
  {
    id: 'expand',
    header: () => <div className="w-[20px]" />,
    cell: ({ row }) => {
      const tx = row.original
      // Đã xóa vạch dọc thẳng đứng, trả về khoảng trống sạch sẽ
      if (tx._rowType) return <div className="w-[20px]" />

      if (!tx.isRecurring) return <div className="w-[20px]" />
      const isExpanded = expandedRows.has(tx._id)
      return (
        <div className="w-[20px] flex justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onExpandRow(tx._id)
            }}
            className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted cursor-pointer transition-colors"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent text-[13px] font-semibold"
      >
        Date
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const isSubRow = !!row.original._rowType
      return (
        <div
          className={`w-[80px] whitespace-nowrap text-[13px] ${isSubRow ? 'italic text-muted-foreground' : ''}`}
        >
          {format(new Date(row.original.date), 'MMM dd, yyyy')}
        </div>
      )
    }
  },
  {
    accessorKey: 'title',
    header: () => <div className="text-[13px] font-semibold">Title</div>,
    cell: ({ row }) => {
      const tx = row.original
      const isSubRow = !!tx._rowType
      const isUpcoming = tx._rowType === 'upcoming'
      return (
        <div className="flex items-center">
          {/* L-connector cho giao dịch con */}
          {isSubRow && (
            <div className="w-3 h-4 border-l-2 border-b-2 border-border rounded-bl-sm mr-2 -translate-y-2 shrink-0" />
          )}
          <div
            className={`min-w-[120px] max-w-[220px] truncate text-[13px] ${
              !isSubRow
                ? 'font-medium text-foreground' // Dòng cha: Chữ đậm, nét căng
                : isUpcoming
                  ? 'italic text-muted-foreground' // Dòng Upcoming: In nghiêng, xám vừa
                  : 'text-slate-700 dark:text-slate-300' // Dòng con đã chạy: Xám đậm, cực kỳ dễ đọc
            }`}
            title={tx.title}
          >
            {tx.title}
          </div>
        </div>
      )
    }
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="p-0 hover:bg-transparent text-[13px] font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Category
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="w-[85px] capitalize truncate text-[13px]">
        {row.original.category}
      </div>
    )
  },
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent text-[13px] font-semibold"
      >
        Type
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="w-[70px] capitalize">
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${
            row.getValue('type') === _TRANSACTION_TYPE.INCOME
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {row.getValue('type')}
        </span>
      </div>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id))
  },
  {
    accessorKey: 'amount',
    header: () => (
      <div className="text-right whitespace-nowrap text-[13px] font-semibold">
        Amount
      </div>
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'))
      const type = row.getValue('type')
      const currency = (row.original.currency ??
        CURRENCY_ENUM.USD) as CurrencyType
      return (
        <div
          className={`min-w-[70px] text-right font-medium whitespace-nowrap text-[13px] ${
            type === _TRANSACTION_TYPE.INCOME
              ? 'text-green-600'
              : 'text-destructive'
          }`}
        >
          {type === _TRANSACTION_TYPE.EXPENSE ? '-' : '+'}
          {formatCurrency(amount, { currency })}
        </div>
      )
    }
  },
  {
    accessorKey: 'currency',
    header: ({ column }) => (
      <div className="flex justify-center">
        <Button
          variant="ghost"
          className="p-0 hover:bg-transparent text-[13px] font-semibold"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Currency
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const currency = (row.original.currency ??
        CURRENCY_ENUM.USD) as CurrencyType
      const symbol =
        CURRENCY_SYMBOLS[currency] ?? CURRENCY_SYMBOLS[CURRENCY_ENUM.USD]
      return (
        <div className="w-[65px] mx-auto text-center font-medium whitespace-nowrap">
          <span className="text-muted-foreground text-[12px]">{symbol}</span>
          <span className="ml-1 inline-block text-[12px]">{currency}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent text-[13px] font-semibold"
      >
        Imported
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="w-[80px] whitespace-nowrap text-muted-foreground text-[13px]">
        {format(new Date(row.getValue('createdAt')), 'MMM dd, yyyy')}
      </div>
    )
  },
  {
    accessorKey: 'paymentMethod',
    header: () => (
      <div className="text-[13px] font-semibold whitespace-nowrap">Payment</div>
    ),
    cell: ({ row }) => {
      const paymentMethod = row.original.paymentMethod
      if (!paymentMethod) return <div className="w-[85px] text-[13px]">N/A</div>
      return (
        <div className="w-[85px] capitalize text-[13px] truncate">
          {paymentMethod.replace('_', ' ').toLowerCase()}
        </div>
      )
    }
  },
  {
    accessorKey: 'recurringInterval',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent text-[13px] font-semibold"
      >
        Recurring
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const tx = row.original
      if (tx._rowType) return <div className="w-[95px]" />

      const frequency = tx.recurringInterval
      const nextDate = tx.nextRecurringDate
      const isRecurring = tx.isRecurring

      const frequencyMap: FrequencyMapType = isRecurring
        ? {
            [_TRANSACTION_FREQUENCY.DAILY]: { label: 'Daily', icon: RefreshCw },
            [_TRANSACTION_FREQUENCY.WEEKLY]: {
              label: 'Weekly',
              icon: RefreshCw
            },
            [_TRANSACTION_FREQUENCY.MONTHLY]: {
              label: 'Monthly',
              icon: RefreshCw
            },
            [_TRANSACTION_FREQUENCY.YEARLY]: {
              label: 'Yearly',
              icon: RefreshCw
            },
            DEFAULT: { label: 'One-time', icon: CircleDot }
          }
        : { DEFAULT: { label: 'One-time', icon: CircleDot } }

      const frequencyKey = isRecurring ? (frequency as string) : 'DEFAULT'
      const { label, icon: Icon } =
        frequencyMap[frequencyKey] || frequencyMap.DEFAULT

      return (
        <div className="w-[95px] flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex flex-col truncate">
            <span className="text-[13px]">{label}</span>
            {nextDate && isRecurring && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                Next: {format(new Date(nextDate), 'MMM dd')}
              </span>
            )}
          </div>
        </div>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id))
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="p-0 hover:bg-transparent text-[13px] font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Status
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const tx = row.original

      // UI cho trạng thái Upcoming (Có dấu chấm trắng bên trong)
      if (tx._rowType === 'upcoming') {
        return (
          <div className="w-[95px] flex items-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-400 text-white shadow-sm whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-white opacity-90" />
              Upcoming
            </span>
          </div>
        )
      }

      // UI Pill Badges cho các trạng thái còn lại (Cũng có dấu chấm trắng)
      const status = (tx.status as string) || 'COMPLETED'
      const statusConfig: Record<string, { color: string; label: string }> = {
        COMPLETED: { color: 'bg-green-500', label: 'Completed' },
        PENDING: { color: 'bg-orange-400', label: 'Pending' }, // Dùng orange-400 cho màu cam mềm giống hình
        FAILED: { color: 'bg-red-500', label: 'Failed' }
      }

      const config = statusConfig[status.toUpperCase()] || {
        color: 'bg-gray-500',
        label: status
      }

      return (
        <div className="w-[95px] flex items-center">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white shadow-sm capitalize whitespace-nowrap ${config.color}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white opacity-90" />
            {config.label}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id))
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      // Ẩn nút 3 chấm cho dòng upcoming
      if (row.original._rowType === 'upcoming')
        return <div className="w-[30px]" />

      return (
        <div className="w-[30px] text-right">
          <ActionsCell row={row} />
        </div>
      )
    }
  }
]

export const transactionColumns = createTransactionColumns(new Set(), () => {})

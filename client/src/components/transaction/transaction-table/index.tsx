import { DataTable } from '@/components/data-table'
import { createTransactionColumns, DisplayTransaction } from './column'
import {
  _TRANSACTION_TYPE,
  _TransactionType,
  CURRENCY_OPTIONS,
  CurrencyType
} from '@/constant'
import { useState, useEffect, useMemo, useCallback } from 'react'
import useDebouncedSearch from '@/hooks/use-debounce-search'
import {
  useBulkDeleteTransactionMutation,
  useGetAllTransactionsQuery,
  useLazyGetChildTransactionsQuery,
  usePrefetch
} from '@/features/transaction/transactionAPI'
import { toast } from 'sonner'
import {
  ColumnDef,
  ExpandedState,
  sortingFns,
  Row,
  SortingFn // Import thêm type này
} from '@tanstack/react-table'
import { TransactionType } from '@/features/transaction/transationType'

type FilterType = {
  type?: _TransactionType | undefined
  recurringStatus?: 'RECURRING' | 'NON_RECURRING' | undefined
  currency?: CurrencyType | undefined
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | undefined
  pageNumber?: number
  pageSize?: number
}

type ChildrenMapType = Record<
  string,
  { parent: TransactionType; children: TransactionType[] }
>

const TransactionTable = (props: {
  pageSize?: number
  isShowPagination?: boolean
  hiddenColumns?: string[]
}) => {
  const [filter, setFilter] = useState<FilterType>({
    type: undefined,
    recurringStatus: undefined,
    currency: undefined,
    status: undefined,
    pageNumber: 1,
    pageSize: props.pageSize || 10
  })

  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [childrenMap, setChildrenMap] = useState<ChildrenMapType>({})

  const [fetchChildren] = useLazyGetChildTransactionsQuery()
  const { debouncedTerm, setSearchTerm } = useDebouncedSearch('', {
    delay: 500
  })
  const [bulkDeleteTransaction, { isLoading: isBulkDeleting }] =
    useBulkDeleteTransactionMutation()

  const { data, isFetching } = useGetAllTransactionsQuery({
    keyword: debouncedTerm,
    type: filter.type,
    recurringStatus: filter.recurringStatus,
    currency: filter.currency || undefined,
    status: filter.status || undefined,
    pageNumber: filter.pageNumber,
    pageSize: filter.pageSize
  })

  const transactions = useMemo(
    () => data?.transactions || [],
    [data?.transactions]
  )

  const pagination = {
    totalItems: data?.pagination?.totalCount || 0,
    totalPages: data?.pagination?.totalPages || 0,
    pageNumber: filter.pageNumber,
    pageSize: filter.pageSize
  }

  const handleExpandRow = useCallback(
    async (transactionId: string) => {
      // 1. KIỂM TRA EXPAND AN TOÀN (Fix lỗi ts 7053)
      const isExpanded =
        typeof expanded === 'object'
          ? expanded[transactionId]
          : expanded === true

      if (isExpanded) {
        setExpanded((prev) => {
          // Khởi tạo object an toàn trước khi spread (Fix lỗi ts 2698)
          const next = typeof prev === 'object' ? { ...prev } : {}
          delete next[transactionId]
          return next
        })
        return
      }

      if (!childrenMap[transactionId]) {
        try {
          const result = await fetchChildren(transactionId).unwrap()
          setChildrenMap((prev: ChildrenMapType) => ({
            ...prev,
            [transactionId]: result
          }))
        } catch {
          toast.error('Failed to load child transactions')
          return
        }
      }

      setExpanded((prev) => {
        const next = typeof prev === 'object' ? { ...prev } : {}
        next[transactionId] = true
        return next
      })
    },
    [expanded, childrenMap, fetchChildren]
  )

  const displayTransactions = useMemo(() => {
    type TransactionWithSubRows = DisplayTransaction & {
      subRows?: DisplayTransaction[]
    }

    const result: TransactionWithSubRows[] = []

    for (const tx of transactions) {
      const parentTx: TransactionWithSubRows = { ...tx }

      if (tx.isRecurring && childrenMap[tx._id]) {
        const cached = childrenMap[tx._id]
        parentTx.subRows = []

        if (tx.nextRecurringDate) {
          parentTx.subRows.push({
            ...tx,
            _id: `upcoming-${tx._id}`,
            date: tx.nextRecurringDate,
            title: `${tx.title} - Upcoming`,
            status: 'UPCOMING',
            _rowType: 'upcoming'
          } as DisplayTransaction)
        }

        const sortedChildren = [...cached.children].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        })

        for (const child of sortedChildren) {
          parentTx.subRows.push({
            ...child,
            _rowType: 'child'
          } as DisplayTransaction)
        }
      }

      result.push(parentTx)
    }

    return result
  }, [transactions, childrenMap])

  const columns = useMemo(() => {
    // Ép kiểu an toàn để lấy mảng keys
    const expandedSet = new Set(
      typeof expanded === 'object' ? Object.keys(expanded) : []
    )
    const baseCols = createTransactionColumns(expandedSet, handleExpandRow)

    // 2. KHAI BÁO TYPE CHUẨN ĐỂ FIX ESLINT "any"
    const enhancedCols = baseCols.map((col) => {
      // Định nghĩa type ép kiểu cho cột
      const colDef = col as ColumnDef<TransactionType> & {
        sortingFn?: SortingFn<TransactionType> | string
      }
      const originalSort = colDef.sortingFn

      return {
        ...col,
        sortingFn: (
          rowA: Row<TransactionType>,
          rowB: Row<TransactionType>,
          columnId: string
        ) => {
          if (rowA.parentId && rowB.parentId) {
            return 0
          }

          if (typeof originalSort === 'function') {
            return originalSort(rowA, rowB, columnId)
          }
          if (typeof originalSort === 'string' && originalSort in sortingFns) {
            const sortFn = sortingFns[
              originalSort as keyof typeof sortingFns
            ] as SortingFn<TransactionType>
            return sortFn(rowA, rowB, columnId)
          }

          // 3. FIX LỖI TS(2339): Đổi auto thành alphanumeric
          return sortingFns.alphanumeric(rowA, rowB, columnId)
        }
      } as ColumnDef<TransactionType>
    })

    if (!props.hiddenColumns) return enhancedCols

    return enhancedCols.filter((col) => {
      const key =
        'accessorKey' in col ? String(col.accessorKey) : (col.id ?? '')
      return !props.hiddenColumns!.includes(key)
    })
  }, [expanded, handleExpandRow, props.hiddenColumns])

  const handleSearch = (value: string) => setSearchTerm(value)

  const handleFilterChange = (filters: Record<string, string>) => {
    if (Object.keys(filters).length === 0) {
      setFilter((prev) => ({
        type: undefined,
        recurringStatus: undefined,
        currency: undefined,
        status: undefined,
        pageNumber: 1,
        pageSize: prev.pageSize
      }))
      return
    }
    setFilter((prev) => ({ ...prev, ...filters, pageNumber: 1 }))
  }

  const handlePageChange = (pageNumber: number) =>
    setFilter((prev) => ({ ...prev, pageNumber }))

  const handlePageSizeChange = (pageSize: number) =>
    setFilter((prev) => ({ ...prev, pageSize }))

  const handleBulkDelete = (transactionIds: string[]) => {
    bulkDeleteTransaction(transactionIds)
      .unwrap()
      .then(() => toast.success('Transactions deleted successfully'))
      .catch((error) =>
        toast.error(error.data?.message || 'Failed to delete transactions')
      )
  }

  const prefetchTransactions = usePrefetch('getAllTransactions', {
    ifOlderThan: 60
  })

  useEffect(() => {
    if (!isFetching && data) {
      const totalPages = data.pagination?.totalPages || 0
      const currentPage = filter.pageNumber || 1
      if (currentPage < totalPages) {
        prefetchTransactions({
          keyword: debouncedTerm,
          type: filter.type,
          recurringStatus: filter.recurringStatus,
          currency: filter.currency,
          status: filter.status,
          pageNumber: currentPage + 1,
          pageSize: filter.pageSize
        })
      }
    }
  }, [isFetching, data, filter, debouncedTerm, prefetchTransactions])

  const handleHoverPage = (page: number) => {
    const currentPage = filter.pageNumber || 1
    if (page !== currentPage + 1) {
      prefetchTransactions({
        keyword: debouncedTerm,
        type: filter.type,
        recurringStatus: filter.recurringStatus,
        currency: filter.currency,
        status: filter.status,
        pageNumber: page,
        pageSize: filter.pageSize
      })
    }
  }

  return (
    <DataTable
      data={displayTransactions as TransactionType[]}
      columns={columns as ColumnDef<TransactionType>[]}
      expanded={expanded}
      onExpandedChange={setExpanded}
      searchPlaceholder="Search transactions..."
      isLoading={isFetching}
      isBulkDeleting={isBulkDeleting}
      isShowPagination={props.isShowPagination}
      pagination={pagination}
      filters={[
        {
          key: 'type',
          label: 'All Types',
          options: [
            { value: _TRANSACTION_TYPE.INCOME, label: 'Income' },
            { value: _TRANSACTION_TYPE.EXPENSE, label: 'Expense' }
          ]
        },
        {
          key: 'recurringStatus',
          label: 'Frequently',
          options: [
            { value: 'RECURRING', label: 'Recurring' },
            { value: 'NON_RECURRING', label: 'Non-Recurring' }
          ]
        },
        {
          key: 'currency',
          label: 'All Currencies',
          options: CURRENCY_OPTIONS.map((c) => ({
            value: c.value,
            label: c.value
          }))
        },
        {
          key: 'status',
          label: 'All Statuses',
          options: [
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'FAILED', label: 'Failed' }
          ]
        }
      ]}
      onSearch={handleSearch}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      onFilterChange={handleFilterChange}
      onBulkDelete={handleBulkDelete}
      onHoverPage={handleHoverPage}
    />
  )
}

export default TransactionTable

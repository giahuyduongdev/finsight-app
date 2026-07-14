import { DataTable } from '@/components/data-table'
import { DateRangeSelect } from '@/components/date-range-select'
import {
  DateRangeType,
  getDateRangeByPreset
} from '@/components/date-range-select/date-range-options'
import { createTransactionColumns, DisplayTransaction } from './column'
import {
  _TRANSACTION_TYPE,
  _TransactionType,
  CURRENCY_OPTIONS,
  CurrencyType,
  DateRangePreset
} from '@/constant'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import useDebouncedSearch from '@/hooks/use-debounce-search'
import {
  useBulkDeleteTransactionMutation,
  useGetAllTransactionsQuery,
  useLazyGetChildTransactionsQuery,
  usePrefetch
} from '@/features/transaction/transactionAPI'
import { useTypedSelector } from '@/app/hook'
import { toast } from 'sonner'
import {
  ColumnDef,
  ExpandedState,
  sortingFns,
  Row,
  SortingFn // Import thêm type này
} from '@tanstack/react-table'
import { TransactionType } from '@/features/transaction/transactionType'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getTransactionHighlightClassName,
  TRANSACTION_HIGHLIGHT_EVENT,
  TRANSACTION_HIGHLIGHT_DURATION_MS,
  TRANSACTION_HIGHLIGHT_QUERY_PARAM,
  TRANSACTION_HIGHLIGHT_STORAGE_KEY,
  TransactionHighlightEvent
} from '@/features/transaction/transactionHighlight'

type FilterType = {
  type?: _TransactionType | undefined
  recurringStatus?: 'RECURRING' | 'NON_RECURRING' | undefined
  currency?: CurrencyType | undefined
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | undefined
  pageNumber?: number
  pageSize?: number
  dateRangePreset?: DateRangePreset | undefined
  from?: string | undefined
  to?: string | undefined
  timezone?: string | undefined
}

import { GetChildTransactionsResponse } from '@/features/transaction/transactionType'

type ChildrenMapType = Record<string, GetChildTransactionsResponse>

const TransactionTable = (props: {
  pageSize?: number
  isShowPagination?: boolean
  hiddenColumns?: string[]
  dateRange?: DateRangeType
  setDateRange?: (range: DateRangeType) => void
}) => {
  const [internalDateRange, setInternalDateRange] = useState<DateRangeType>(
    () => getDateRangeByPreset()
  )

  // Use external state if provided, otherwise use internal state
  const dateRange =
    props.dateRange !== undefined ? props.dateRange : internalDateRange
  const setDateRange = props.setDateRange || setInternalDateRange
  const isSyncMode = props.dateRange !== undefined

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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightParam = searchParams.get(TRANSACTION_HIGHLIGHT_QUERY_PARAM)
  const importBatchIdParam = searchParams.get('importBatchId')
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(
    () =>
      highlightParam ||
      (typeof window !== 'undefined'
        ? window.sessionStorage.getItem(TRANSACTION_HIGHLIGHT_STORAGE_KEY)
        : null)
  )
  const [pinnedHighlightedTransaction, setPinnedHighlightedTransaction] =
    useState<TransactionType | null>(null)

  const { timezone } = useTypedSelector((state) => state.auth.user) || {
    timezone: 'UTC'
  }
  // Remove local dateRange state as it's now handled by the logic above
  // const [dateRange, setDateRange] = useState<DateRangeType>(null)

  const [fetchChildren] = useLazyGetChildTransactionsQuery()
  const { debouncedTerm, setSearchTerm } = useDebouncedSearch('', {
    delay: 500
  })
  const [bulkDeleteTransaction, { isLoading: isBulkDeleting }] =
    useBulkDeleteTransactionMutation()

  const { data, isFetching, isLoading } = useGetAllTransactionsQuery({
    keyword: debouncedTerm,
    type: filter.type,
    recurringStatus: filter.recurringStatus,
    currency: filter.currency || undefined,
    status: filter.status || undefined,
    pageNumber: filter.pageNumber,
    pageSize: filter.pageSize,
    dateRangePreset: dateRange?.value as DateRangePreset,
    from: dateRange?.from?.toISOString() || undefined,
    to: dateRange?.to?.toISOString() || undefined,
    timezone,
    importBatchId: importBatchIdParam || undefined
  })

  const transactions = useMemo(() => {
    const currentTransactions = data?.data || []

    if (
      !pinnedHighlightedTransaction ||
      currentTransactions.some(
        (transaction) => transaction._id === pinnedHighlightedTransaction._id
      )
    ) {
      return currentTransactions
    }

    return [pinnedHighlightedTransaction, ...currentTransactions]
  }, [data?.data, pinnedHighlightedTransaction])

  useEffect(() => {
    const pendingHighlight =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem(TRANSACTION_HIGHLIGHT_STORAGE_KEY)
        : null
    const nextHighlight = highlightParam || pendingHighlight

    setActiveHighlightId(nextHighlight)

    if (
      nextHighlight &&
      pendingHighlight &&
      nextHighlight === pendingHighlight
    ) {
      window.sessionStorage.removeItem(TRANSACTION_HIGHLIGHT_STORAGE_KEY)
    }

    if (!nextHighlight) return

    const timeout = window.setTimeout(() => {
      setActiveHighlightId((current) =>
        current === nextHighlight ? null : current
      )
      setPinnedHighlightedTransaction((current) =>
        current?._id === nextHighlight ? null : current
      )
    }, TRANSACTION_HIGHLIGHT_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [highlightParam])

  useEffect(() => {
    const handleHighlightRequest = (event: Event) => {
      const transactionId = (event as TransactionHighlightEvent).detail
        ?.transactionId
      const transaction = (event as TransactionHighlightEvent).detail
        ?.transaction

      if (transactionId) {
        setActiveHighlightId(transactionId)
      }

      if (transaction) {
        setPinnedHighlightedTransaction(transaction)
      }
    }

    window.addEventListener(TRANSACTION_HIGHLIGHT_EVENT, handleHighlightRequest)

    return () => {
      window.removeEventListener(
        TRANSACTION_HIGHLIGHT_EVENT,
        handleHighlightRequest
      )
    }
  }, [])

  const pagination = {
    totalItems: data?.meta?.pagination?.totalCount || 0,
    totalPages: data?.meta?.pagination?.totalPages || 0,
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
          const result = await fetchChildren({
            id: transactionId,
            pageNumber: 1
          }).unwrap()
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

  const loadingParentsRef = useRef<Set<string>>(new Set())
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const handleLoadMoreChilds = useCallback(
    async (parentId: string) => {
      // Ngăn chặn gọi API trùng lặp nếu đang fetch dở cho parent này
      if (loadingParentsRef.current.has(parentId)) return

      const cached = childrenMap[parentId]
      if (!cached?.meta?.pagination) return

      const { pageNumber, totalPages } = cached.meta.pagination
      if (pageNumber >= totalPages) return

      loadingParentsRef.current.add(parentId)

      // Create AbortController for this request
      const controller = new AbortController()
      abortControllersRef.current.set(parentId, controller)

      const nextPage = pageNumber + 1
      try {
        const result = await fetchChildren({
          id: parentId,
          pageNumber: nextPage
        }).unwrap()

        setChildrenMap((prev) => {
          const oldCache = prev[parentId]
          return {
            ...prev,
            [parentId]: {
              ...result,
              data: [...oldCache.data, ...result.data]
            }
          }
        })
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request cancelled for parent:', parentId)
          return
        }
        console.error('Failed to load more child transactions:', error)
        toast.error('Failed to load more child transactions')
      } finally {
        loadingParentsRef.current.delete(parentId)
        abortControllersRef.current.delete(parentId)
      }
    },
    [childrenMap, fetchChildren]
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

        const sortedChildren = [...cached.data].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        })

        for (const child of sortedChildren) {
          parentTx.subRows.push({
            ...child,
            _rowType: 'child'
          } as DisplayTransaction)
        }

        if (
          cached.meta?.pagination &&
          cached.data.length < cached.meta.pagination.totalCount
        ) {
          parentTx.subRows.push({
            ...tx,
            _id: `load-more-${tx._id}`,
            parentId: tx._id, // Add parentId used in handleLoadMore
            _rowType: 'load-more',
            title: `Load more (${cached.meta.pagination.totalCount - cached.data.length} remaining)`
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
    const baseCols = createTransactionColumns(
      expandedSet,
      handleExpandRow,
      handleLoadMoreChilds
    )

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

    const hiddenColumnSet = new Set(props.hiddenColumns)

    return enhancedCols.filter((col) => {
      const key =
        'accessorKey' in col ? String(col.accessorKey) : (col.id ?? '')
      return !hiddenColumnSet.has(key)
    })
  }, [expanded, handleExpandRow, handleLoadMoreChilds, props.hiddenColumns])

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

  const handleClearImportBatchFilter = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('importBatchId')
    navigate({
      pathname: '/transactions',
      search: nextParams.toString()
    })
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

  const previousFetching = useRef(isFetching)
  const childrenMapRef = useRef(childrenMap)

  // Keep ref in sync with state
  useEffect(() => {
    childrenMapRef.current = childrenMap
  }, [childrenMap])

  // Cleanup: Cancel all pending requests when component unmounts
  useEffect(() => {
    const controllers = abortControllersRef.current
    return () => {
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
    }
  }, [])

  useEffect(() => {
    if (previousFetching.current && !isFetching) {
      const expandedIds =
        typeof expanded === 'object'
          ? Object.keys(expanded).filter((k) => expanded[k])
          : []
      if (expandedIds.length > 0) {
        expandedIds.forEach((id) => {
          // Chỉ fetch lại nếu dòng cha đó vẫn nằm trong danh sách đang hiển thị
          if (transactions.some((tx) => tx._id === id)) {
            // Lấy số lượng đã load hiện tại để refresh đúng bấy nhiêu
            const currentCount = childrenMapRef.current[id]?.data?.length || 10

            // Backend giới hạn 50, nếu xem nhiều hơn thì phải fetch nhiều trang
            const CHUNK_SIZE = 50
            const pagesToFetch = Math.ceil(currentCount / CHUNK_SIZE)

            Promise.all(
              Array.from({ length: pagesToFetch }, (_, idx) =>
                fetchChildren({
                  id,
                  pageNumber: idx + 1,
                  pageSize: CHUNK_SIZE
                }).unwrap()
              )
            )
              .then((results) => {
                const mergedChildren = results
                  .flatMap((r) => r.data)
                  .slice(0, currentCount)
                const latest = results[results.length - 1]
                setChildrenMap((prev: ChildrenMapType) => ({
                  ...prev,
                  [id]: {
                    ...latest,
                    data: mergedChildren,
                    meta: {
                      ...latest.meta,
                      pagination: latest.meta?.pagination
                        ? {
                            ...latest.meta.pagination,
                            pageNumber: Math.ceil(mergedChildren.length / 10),
                            pageSize: 10,
                            totalPages: Math.ceil(
                              latest.meta.pagination.totalCount / 10
                            )
                          }
                        : childrenMapRef.current[id]?.meta?.pagination
                    }
                  }
                }))
              })
              .catch((error) => {
                console.error(
                  `Failed to refresh children for transaction ${id}:`,
                  error
                )
              })
          }
        })
      }
    }
    previousFetching.current = isFetching
  }, [isFetching, expanded, fetchChildren, transactions])

  useEffect(() => {
    if (!isFetching && data) {
      const totalPages = data.meta?.pagination?.totalPages || 0
      const currentPage = filter.pageNumber || 1
      if (currentPage < totalPages) {
        prefetchTransactions({
          keyword: debouncedTerm,
          type: filter.type,
          recurringStatus: filter.recurringStatus,
          currency: filter.currency,
          status: filter.status,
          pageNumber: currentPage + 1,
          pageSize: filter.pageSize,
          dateRangePreset: filter.dateRangePreset,
          from: filter.from,
          to: filter.to,
          timezone: filter.timezone,
          importBatchId: importBatchIdParam || undefined
        })
      }
    }
  }, [
    isFetching,
    data,
    filter,
    debouncedTerm,
    prefetchTransactions,
    importBatchIdParam
  ])

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
        pageSize: filter.pageSize,
        dateRangePreset: dateRange?.value as DateRangePreset, // Cast to proper union type
        from: dateRange?.from?.toISOString() || undefined,
        to: dateRange?.to?.toISOString() || undefined,
        timezone,
        importBatchId: importBatchIdParam || undefined
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
      features={{ pagination: props.isShowPagination }}
      loadingState={{
        table: isLoading && !data,
        bulkDelete: isBulkDeleting
      }}
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
      getRowClassName={(row) =>
        getTransactionHighlightClassName(
          Boolean(activeHighlightId && row._id === activeHighlightId)
        )
      }
      renderExtraFilters={
        <>
          {!isSyncMode && (
            <DateRangeSelect
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          )}
          {importBatchIdParam && (
            <div className="flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-800">
              <span title={`Import batch ${importBatchIdParam}`}>
                Showing transactions from the latest import
              </span>
              <button
                type="button"
                className="cursor-pointer font-medium underline-offset-2 hover:underline"
                onClick={handleClearImportBatchFilter}
              >
                Clear
              </button>
            </div>
          )}
        </>
      }
    />
  )
}

export default TransactionTable

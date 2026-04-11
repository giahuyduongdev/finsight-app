import { DataTable } from '@/components/data-table'
import { transactionColumns } from './column'
import {
  _TRANSACTION_TYPE,
  _TransactionType,
  CURRENCY_OPTIONS,
  CurrencyType
} from '@/constant'
import { useState, useEffect } from 'react'
import useDebouncedSearch from '@/hooks/use-debounce-search'
import {
  useBulkDeleteTransactionMutation,
  useGetAllTransactionsQuery,
  usePrefetch
} from '@/features/transaction/transactionAPI'
import { toast } from 'sonner'
import { ColumnDef } from '@tanstack/react-table'
import { TransactionType } from '@/features/transaction/transationType'

type FilterType = {
  type?: _TransactionType | undefined
  recurringStatus?: 'RECURRING' | 'NON_RECURRING' | undefined
  currency?: CurrencyType | undefined
  pageNumber?: number
  pageSize?: number
}

const TransactionTable = (props: {
  pageSize?: number
  isShowPagination?: boolean
  hiddenColumns?: string[]
}) => {
  const [filter, setFilter] = useState<FilterType>({
    type: undefined,
    recurringStatus: undefined,
    pageNumber: 1,
    pageSize: props.pageSize || 10
  })

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
    pageNumber: filter.pageNumber,
    pageSize: filter.pageSize
  })

  const transactions = data?.transactions || []
  const pagination = {
    totalItems: data?.pagination?.totalCount || 0,
    totalPages: data?.pagination?.totalPages || 0,
    pageNumber: filter.pageNumber,
    pageSize: filter.pageSize
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
  }

  const handleFilterChange = (filters: Record<string, string>) => {
    if (Object.keys(filters).length === 0) {
      setFilter((prev) => ({
        type: undefined,
        recurringStatus: undefined,
        currency: undefined,
        pageNumber: 1,
        pageSize: prev.pageSize
      }))
      return
    }

    setFilter((prev) => ({
      ...prev,
      ...filters,
      pageNumber: 1
    }))
  }

  const handlePageChange = (pageNumber: number) => {
    setFilter((prev) => ({ ...prev, pageNumber }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setFilter((prev) => ({ ...prev, pageSize }))
  }

  const handleBulkDelete = (transactionIds: string[]) => {
    bulkDeleteTransaction(transactionIds)
      .unwrap()
      .then(() => {
        toast.success('Transactions deleted successfully')
      })
      .catch((error) => {
        toast.error(error.data?.message || 'Failed to delete transactions')
      })
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
        pageNumber: page,
        pageSize: filter.pageSize
      })
    }
  }

  const columns: ColumnDef<TransactionType>[] = props.hiddenColumns
    ? transactionColumns.filter((col) => {
        const key =
          'accessorKey' in col ? String(col.accessorKey) : (col.id ?? '')
        return !props.hiddenColumns!.includes(key)
      })
    : transactionColumns

  return (
    <DataTable
      data={transactions}
      columns={columns}
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
          key: 'frequently',
          label: 'Frequently',
          options: [
            { value: 'RECURRING', label: 'Recurring' },
            { value: 'NON_RECURRING', label: 'Non-Recurring' }
          ]
        },
        // Cập nhật khối Filter Currency này
        {
          key: 'currency',
          label: 'All Currencies',
          // Lấy đúng mảng bạn đã định nghĩa trong constant, biến tấu xíu cho nhãn nó gọn gàng
          options: CURRENCY_OPTIONS.map((c) => ({
            value: c.value,
            label: c.value // Chỉ hiện chữ VND, USD thay vì "VND - Vietnam Dong" cho UI đỡ rối
          }))
        }
      ]}
      onSearch={handleSearch}
      onPageChange={(pageNumber) => handlePageChange(pageNumber)}
      onPageSizeChange={(pageSize) => handlePageSizeChange(pageSize)}
      onFilterChange={(filters) => handleFilterChange(filters)}
      onBulkDelete={handleBulkDelete}
      onHoverPage={handleHoverPage}
    />
  )
}
export default TransactionTable

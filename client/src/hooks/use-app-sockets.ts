import { useEffect, useRef } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { toast } from 'sonner'
import { useSocket } from './use-socket'
import { apiClient } from '@/app/api-client'
import { transactionApi } from '@/features/transaction/transactionAPI'
import { 
  TransactionType, 
  GetAllTransactionResponse, 
  GetAllTransactionParams 
} from '@/features/transaction/transationType'
import { AppDispatch, RootState } from '@/app/store'

// --- Socket Payloads ---
interface BulkImportProgressPayload {
  progress: number
  totalInserted: number
  rejectedCount: number
  totalProcessed: number
  total: number
}

interface BulkImportCompletedPayload {
  totalInserted: number
  rejectedCount: number
  totalProcessed: number
  message: string
}

interface BulkImportFailedPayload {
  message: string
}

interface RecurringTransactionProcessedPayload {
  message: string
}

/**
 * Hook tổng hợp để quản lý TẤT CẢ các sự kiện Socket trong hệ thống.
 * Gom về một mối để tránh lỗi "Order of Hooks" và tối ưu hiệu năng.
 */
export const useAppSockets = () => {
  const socket = useSocket()
  const dispatch = useDispatch<AppDispatch>()
  const store = useStore()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!socket) return

    // --- 1. ĐỒNG BỘ GIAO DỊCH (SYNC) ---
    const updateAllTransactionQueries = (
      updater: (draft: GetAllTransactionResponse, args: GetAllTransactionParams) => void
    ) => {
      const state = store.getState() as RootState
      const queries = state.api.queries

      Object.values(queries).forEach((query) => {
        // Kiểm tra đúng endpoint và trạng thái thành công
        if (
          query?.endpointName === 'getAllTransactions' && 
          query?.status === 'fulfilled'
        ) {
          const args = query.originalArgs as GetAllTransactionParams
          dispatch(
            transactionApi.util.updateQueryData(
              'getAllTransactions',
              args,
              (draft) => updater(draft, args)
            )
          )
        }
      })
    }

    socket.on('transaction:created', (newTx: TransactionType) => {
      console.log('🚀 [Sync] Created:', newTx._id)
      updateAllTransactionQueries((draft, args) => {
        if (args.pageNumber === 1 || !args.pageNumber) {
          if (!draft.transactions.some((t) => t._id === newTx._id)) {
            draft.transactions.unshift(newTx)
            if (draft.pagination) draft.pagination.totalCount += 1
          }
        }
      })
      dispatch(apiClient.util.invalidateTags(['analytics']))
    })

    socket.on('transaction:updated', (updatedTx: TransactionType) => {
      console.log('🔄 [Sync] Updated:', updatedTx._id)
      updateAllTransactionQueries((draft) => {
        const index = draft.transactions.findIndex((t) => t._id === updatedTx._id)
        if (index !== -1) draft.transactions[index] = updatedTx
      })
      dispatch(
        transactionApi.util.updateQueryData(
          'getSingleTransaction',
          updatedTx._id,
          (draft) => { 
            draft.transaction = updatedTx 
          }
        )
      )
      dispatch(apiClient.util.invalidateTags(['analytics']))
    })

    socket.on('transaction:deleted', ({ _id }: { _id: string }) => {
      console.log('🗑️ [Sync] Deleted:', _id)
      updateAllTransactionQueries((draft) => {
        const index = draft.transactions.findIndex((t) => t._id === _id)
        if (index !== -1) {
          draft.transactions.splice(index, 1)
          if (draft.pagination) draft.pagination.totalCount -= 1
        }
      })
      dispatch(apiClient.util.invalidateTags(['analytics']))
    })

    socket.on('transaction:bulk-deleted', ({ ids }: { ids: string[] }) => {
      console.log('🗑️ [Sync] Bulk Deleted:', ids.length)
      updateAllTransactionQueries((draft) => {
        const initialCount = draft.transactions.length
        draft.transactions = draft.transactions.filter((t) => !ids.includes(t._id))
        const deletedCountProps = initialCount - draft.transactions.length
        if (draft.pagination) draft.pagination.totalCount -= deletedCountProps
      })
      dispatch(apiClient.util.invalidateTags(['analytics']))
    })

    // --- 2. BULK IMPORT ---
    socket.on('bulk-import:progress', ({ progress, totalProcessed, total, rejectedCount }: BulkImportProgressPayload) => {
      const rejectedMsg = rejectedCount > 0 ? ` (${rejectedCount} rejected)` : ''
      toast.loading(`Importing... ${totalProcessed}/${total}${rejectedMsg} (${progress}%)`, { id: 'bulk-import' })
    })

    socket.on('bulk-import:completed', ({ message }: BulkImportCompletedPayload) => {
      toast.success(message || 'Import completed', { id: 'bulk-import', duration: 4000 })
      dispatch(apiClient.util.invalidateTags(['transactions', 'analytics']))
    })

    socket.on('bulk-import:failed', ({ message }: BulkImportFailedPayload) => {
      toast.error(message, { id: 'bulk-import' })
    })

    // --- 3. RECURRING TRANSACTIONS ---
    socket.on('recurring-transaction:processed', (data: RecurringTransactionProcessedPayload) => {
      toast.success(data.message || 'Processing recurring transactions...', { id: 'recurring-update', duration: 3000 })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        dispatch(apiClient.util.invalidateTags(['transactions', 'analytics']))
      }, 1000)
    })

    return () => {
      socket.off('transaction:created')
      socket.off('transaction:updated')
      socket.off('transaction:deleted')
      socket.off('transaction:bulk-deleted')
      socket.off('bulk-import:progress')
      socket.off('bulk-import:completed')
      socket.off('bulk-import:failed')
      socket.off('recurring-transaction:processed')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [socket, dispatch, store])
}

import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import { useSocket } from './use-socket'
import { apiClient } from '@/app/api-client'
import { AppDispatch } from '@/app/store'
import { userApi } from '@/features/user/userAPI'

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

type ProfileUpdatedField =
  | 'name'
  | 'profilePicture'
  | 'timezone'
  | 'preferredCurrency'

interface ProfileUpdatedPayload {
  changedFields?: ProfileUpdatedField[]
}

export const useAppSockets = () => {
  const socket = useSocket()
  const dispatch = useDispatch<AppDispatch>()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!socket) return

    const refreshTransactionData = () => {
      dispatch(apiClient.util.invalidateTags(['transactions', 'analytics']))
    }

    const refreshCurrentUser = () => {
      dispatch(
        userApi.endpoints.getCurrentUser.initiate(undefined, {
          forceRefetch: true,
          subscribe: false
        })
      )
    }

    const handleProfileUpdated = ({ changedFields }: ProfileUpdatedPayload) => {
      if (!Array.isArray(changedFields)) {
        dispatch(apiClient.util.invalidateTags(['user']))
        refreshCurrentUser()
        return
      }

      const tags = new Set<'analytics' | 'report' | 'transactions' | 'user'>([
        'user'
      ])

      if (changedFields.includes('timezone')) {
        tags.add('analytics')
        tags.add('transactions')
        tags.add('report')
      }

      if (changedFields.includes('preferredCurrency')) {
        tags.add('analytics')
        tags.add('report')
      }

      dispatch(apiClient.util.invalidateTags([...tags]))
      refreshCurrentUser()
    }

    socket.on('transaction:created', refreshTransactionData)
    socket.on('transaction:updated', refreshTransactionData)
    socket.on('transaction:deleted', refreshTransactionData)
    socket.on('transaction:bulk-deleted', refreshTransactionData)
    socket.on('user:profile-updated', handleProfileUpdated)

    socket.on(
      'bulk-import:progress',
      ({
        progress,
        totalProcessed,
        total,
        rejectedCount
      }: BulkImportProgressPayload) => {
        const rejectedMsg =
          rejectedCount > 0 ? ` (${rejectedCount} rejected)` : ''
        toast.loading(
          `Importing... ${totalProcessed}/${total}${rejectedMsg} (${progress}%)`,
          { id: 'bulk-import' }
        )
      }
    )

    socket.on(
      'bulk-import:completed',
      ({ message }: BulkImportCompletedPayload) => {
        toast.success(message || 'Import completed', {
          id: 'bulk-import',
          duration: 4000
        })
        refreshTransactionData()
      }
    )

    socket.on('bulk-import:failed', ({ message }: BulkImportFailedPayload) => {
      toast.error(message, { id: 'bulk-import' })
    })

    socket.on(
      'recurring-transaction:processed',
      (data: RecurringTransactionProcessedPayload) => {
        toast.success(data.message || 'Processing recurring transactions...', {
          id: 'recurring-update',
          duration: 3000
        })
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(refreshTransactionData, 1000)
      }
    )

    return () => {
      socket.off('transaction:created', refreshTransactionData)
      socket.off('transaction:updated', refreshTransactionData)
      socket.off('transaction:deleted', refreshTransactionData)
      socket.off('transaction:bulk-deleted', refreshTransactionData)
      socket.off('user:profile-updated', handleProfileUpdated)
      socket.off('bulk-import:progress')
      socket.off('bulk-import:completed')
      socket.off('bulk-import:failed')
      socket.off('recurring-transaction:processed')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [socket, dispatch])
}

import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import { useSocket } from './use-socket'
import { apiClient } from '@/app/api-client'
import { AppDispatch } from '@/app/store'
import { userApi } from '@/features/user/userAPI'
import { logout, updateCredentials } from '@/features/auth/authSlice'
import { redirectTo as navigateTo } from '@/lib/navigation'
import { subscribeToLocalLogout } from '@/lib/local-logout-sync'
import { saveFlashMessage } from '@/lib/flash-message'

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

interface ReportSettingsUpdatedPayload {
  reportSetting?: {
    _id?: string
    userId?: string
    frequency?: string
    isEnabled?: boolean
    lastSentDate?: string | null
    nextReportDate?: string | null
  }
}

interface ReportListUpdatedPayload {
  source?: 'api' | 'worker'
  status?: 'SENT' | 'FAILED' | 'NO_ACTIVITY' | 'PENDING'
}

interface AuthSessionRevokedPayload {
  message?: string
  redirectTo?: string
}

export const useAppSockets = () => {
  const socket = useSocket()
  const dispatch = useDispatch<AppDispatch>()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const logoutHandledRef = useRef(false)

  useEffect(() => {
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

    const handleReportSettingsUpdated = ({
      reportSetting
    }: ReportSettingsUpdatedPayload = {}) => {
      if (reportSetting) {
        dispatch(updateCredentials({ reportSetting }))
      }
      dispatch(apiClient.util.invalidateTags(['report']))
    }

    const handleReportListUpdated = ({
      source,
      status
    }: ReportListUpdatedPayload = {}) => {
      dispatch(apiClient.util.invalidateTags(['report']))

      if (source !== 'worker') return

      if (status === 'SENT') {
        toast.success('Monthly report generated')
      } else if (status === 'FAILED') {
        toast.error('Monthly report failed')
      } else if (status === 'NO_ACTIVITY') {
        toast.info('No activity found for this report period')
      }
    }

    const handleAuthSessionRevoked = ({
      message,
      redirectTo: redirectUrl
    }: AuthSessionRevokedPayload = {}) => {
      if (logoutHandledRef.current) return
      logoutHandledRef.current = true

      saveFlashMessage({
        message: message || 'Your session ended. Please sign in again',
        type: 'info'
      })
      dispatch(logout())
      dispatch(apiClient.util.resetApiState())
      navigateTo(redirectUrl || '/')
    }

    const handleLocalLogout = () => {
      if (logoutHandledRef.current) return
      logoutHandledRef.current = true

      saveFlashMessage({
        message: 'Logged out successfully',
        type: 'info'
      })
      dispatch(logout())
      dispatch(apiClient.util.resetApiState())
      navigateTo('/')
    }

    const unsubscribeLocalLogout = subscribeToLocalLogout(handleLocalLogout)

    if (!socket) {
      return unsubscribeLocalLogout
    }

    socket.on('transaction:created', refreshTransactionData)
    socket.on('transaction:updated', refreshTransactionData)
    socket.on('transaction:deleted', refreshTransactionData)
    socket.on('transaction:bulk-deleted', refreshTransactionData)
    socket.on('user:profile-updated', handleProfileUpdated)
    socket.on('report:settings-updated', handleReportSettingsUpdated)
    socket.on('report:list-updated', handleReportListUpdated)
    socket.on('auth:session-revoked', handleAuthSessionRevoked)

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
      socket.off('report:settings-updated', handleReportSettingsUpdated)
      socket.off('report:list-updated', handleReportListUpdated)
      socket.off('auth:session-revoked', handleAuthSessionRevoked)
      socket.off('bulk-import:progress')
      socket.off('bulk-import:completed')
      socket.off('bulk-import:failed')
      socket.off('recurring-transaction:processed')
      unsubscribeLocalLogout()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [socket, dispatch])
}

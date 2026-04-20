import { useEffect } from 'react'
import { toast } from 'sonner'
import { useSocket } from '../hooks/use-socket'
import { useAppDispatch } from '@/app/hook'
import { apiClient } from '@/app/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type BulkImportProgressPayload = {
  progress: number
  totalInserted: number
  total: number
}

type BulkImportCompletedPayload = {
  totalInserted: number
}

type BulkImportFailedPayload = {
  message: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useBulkImportSocket = () => {
  const socket = useSocket()
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!socket) return

    socket.on(
      'bulk-import:progress',
      ({ progress, totalInserted, total }: BulkImportProgressPayload) => {
        toast.loading(`Importing... ${totalInserted}/${total} (${progress}%)`, {
          id: 'bulk-import'
        })
      }
    )

    socket.on(
      'bulk-import:completed',
      ({ totalInserted }: BulkImportCompletedPayload) => {
        console.log('Received bulk-import:completed', { totalInserted })
        toast.success(`Successfully imported ${totalInserted} transactions`, {
          id: 'bulk-import',
          duration: 4000
        })
        dispatch(apiClient.util.invalidateTags(['transactions', 'analytics']))
      }
    )

    socket.on('bulk-import:failed', ({ message }: BulkImportFailedPayload) => {
      toast.error(message, { id: 'bulk-import' })
    })

    return () => {
      socket.off('bulk-import:progress')
      socket.off('bulk-import:completed')
      socket.off('bulk-import:failed')
    }
  }, [socket, dispatch])
}

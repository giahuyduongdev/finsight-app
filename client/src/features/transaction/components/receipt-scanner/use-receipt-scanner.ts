import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { markNotificationHandledInForeground } from '@/features/notification/notificationPresentation'
import {
  useAiScanReceiptMutation,
  useLazyGetReceiptScanStatusQuery
} from '@/features/transaction/transactionAPI'
import { AIScanReceiptData } from '@/features/transaction/transactionType'
import { useProgressLoader } from '@/hooks/use-progress-loader'
import { useSocket } from '@/hooks/use-socket'

interface UseReceiptScannerOptions {
  onScanComplete: (data: AIScanReceiptData) => void
  onLoadingChange: (isLoading: boolean) => void
}

const PENDING_RECEIPT_JOB_KEY = 'finsight:pending-receipt-job'

export const useReceiptScanner = ({
  onScanComplete,
  onLoadingChange
}: UseReceiptScannerOptions) => {
  const [receipt, setReceipt] = useState<string | null>(null)
  const {
    progress,
    startProgress,
    updateProgress,
    doneProgress,
    resetProgress
  } = useProgressLoader({ initialProgress: 10, completionDelay: 500 })

  const [aiScanReceipt] = useAiScanReceiptMutation()
  const [getReceiptScanStatus] = useLazyGetReceiptScanStatusQuery()
  const socket = useSocket()
  const pendingJobIdRef = useRef<string | null>(null)
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onScanCompleteRef = useRef(onScanComplete)
  const onLoadingChangeRef = useRef(onLoadingChange)

  useEffect(() => {
    onScanCompleteRef.current = onScanComplete
  }, [onScanComplete])

  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange
  }, [onLoadingChange])

  const stopProgressSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const stopSafetyTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const stopCompletionTimeout = useCallback(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current)
      completionTimeoutRef.current = null
    }
  }, [])

  const clearPendingJob = useCallback(() => {
    pendingJobIdRef.current = null
    setPendingJobId(null)
    sessionStorage.removeItem(PENDING_RECEIPT_JOB_KEY)
  }, [])

  const resetState = useCallback(() => {
    stopProgressSimulation()
    stopSafetyTimeout()
    stopCompletionTimeout()
    resetProgress()
    if (receipt && receipt.startsWith('blob:')) {
      URL.revokeObjectURL(receipt)
    }
    setReceipt(null)
    clearPendingJob()
    onLoadingChangeRef.current(false)
  }, [
    receipt,
    resetProgress,
    clearPendingJob,
    stopProgressSimulation,
    stopSafetyTimeout,
    stopCompletionTimeout
  ])

  const completeSuccess = useCallback(() => {
    stopProgressSimulation()
    stopSafetyTimeout()
    stopCompletionTimeout()
    clearPendingJob()
    updateProgress(100)
    completionTimeoutRef.current = setTimeout(() => {
      doneProgress()
      if (receipt && receipt.startsWith('blob:')) {
        URL.revokeObjectURL(receipt)
      }
      setReceipt(null)
      onLoadingChangeRef.current(false)
    }, 500)
  }, [
    receipt,
    doneProgress,
    updateProgress,
    clearPendingJob,
    stopProgressSimulation,
    stopSafetyTimeout,
    stopCompletionTimeout
  ])

  useEffect(() => {
    const storedJobId = sessionStorage.getItem(PENDING_RECEIPT_JOB_KEY)
    if (!storedJobId) return

    pendingJobIdRef.current = storedJobId
    setPendingJobId(storedJobId)
    onLoadingChangeRef.current(true)
    startProgress(10)
  }, [startProgress])

  useEffect(() => {
    return () => {
      stopProgressSimulation()
      stopSafetyTimeout()
      stopCompletionTimeout()
    }
  }, [stopProgressSimulation, stopSafetyTimeout, stopCompletionTimeout])

  useEffect(() => {
    return () => {
      if (receipt && receipt.startsWith('blob:')) {
        URL.revokeObjectURL(receipt)
      }
    }
  }, [receipt])

  useEffect(() => {
    if (!socket) return

    const handleSuccess = (payload: {
      jobId: string
      data: AIScanReceiptData
    }) => {
      if (!pendingJobIdRef.current || payload.jobId !== pendingJobIdRef.current)
        return

      clearPendingJob()
      try {
        markNotificationHandledInForeground(payload.jobId)
        onScanCompleteRef.current(payload.data)
        toast.success('Receipt scanned successfully')
        completeSuccess()
      } catch (error) {
        console.error('[Scanner] Failed to complete scan', error)
        toast.error('Scan completed but UI update failed')
        completeSuccess()
      }
    }

    const handleFailure = (payload: { jobId: string; error: string }) => {
      if (!pendingJobIdRef.current || payload.jobId !== pendingJobIdRef.current)
        return

      markNotificationHandledInForeground(payload.jobId)
      toast.error(payload.error || 'Failed to scan receipt')
      resetState()
    }

    socket.on('receipt:scan-completed', handleSuccess)
    socket.on('receipt:scan-failed', handleFailure)

    return () => {
      socket.off('receipt:scan-completed', handleSuccess)
      socket.off('receipt:scan-failed', handleFailure)
    }
  }, [socket, clearPendingJob, completeSuccess, resetState])

  useEffect(() => {
    if (!pendingJobId) return

    let cancelled = false
    stopSafetyTimeout()
    timeoutRef.current = setTimeout(() => {
      toast.error(
        'Processing timed out. Please check your internet or try again'
      )
      resetState()
    }, 60000)

    const checkStatus = async () => {
      try {
        const response = await getReceiptScanStatus(pendingJobId).unwrap()
        if (cancelled || pendingJobIdRef.current !== pendingJobId) return

        if (response.data.status === 'completed' && response.data.receipt) {
          clearPendingJob()
          markNotificationHandledInForeground(pendingJobId)
          onScanCompleteRef.current(response.data.receipt)
          toast.success('Receipt scanned successfully')
          completeSuccess()
        } else if (response.data.status === 'completed') {
          toast.error(
            'Receipt result is no longer available. Please scan again'
          )
          resetState()
        } else if (response.data.status === 'failed') {
          markNotificationHandledInForeground(pendingJobId)
          toast.error(
            response.data.error || 'Receipt processing failed. Please try again'
          )
          resetState()
        }
      } catch {
        // Socket may still deliver the result. Keep polling until safety timeout.
      }
    }

    void checkStatus()
    const interval = setInterval(checkStatus, 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [
    pendingJobId,
    getReceiptScanStatus,
    stopSafetyTimeout,
    resetState,
    clearPendingJob,
    completeSuccess
  ])

  const handleReceiptUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        toast.error('Please select a file')
        return
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file')
        return
      }

      if (receipt && receipt.startsWith('blob:')) {
        URL.revokeObjectURL(receipt)
      }

      const previewUrl = URL.createObjectURL(file)
      setReceipt(previewUrl)

      const formData = new FormData()
      formData.append('receipt', file)

      startProgress(10)
      onLoadingChangeRef.current(true)

      let currentProgress = 10
      stopProgressSimulation()
      intervalRef.current = setInterval(() => {
        const increment =
          currentProgress < 70 ? 5 : currentProgress < 85 ? 1 : 0.5
        currentProgress = Math.min(currentProgress + increment, 90)
        updateProgress(Math.floor(currentProgress))
      }, 500)

      aiScanReceipt(formData)
        .unwrap()
        .then((res) => {
          if (res.data?.receipt) {
            onScanCompleteRef.current(res.data.receipt)
            toast.success('Receipt scanned successfully')
            completeSuccess()
          } else if (res.data?.jobId) {
            pendingJobIdRef.current = res.data.jobId
            setPendingJobId(res.data.jobId)
            sessionStorage.setItem(PENDING_RECEIPT_JOB_KEY, res.data.jobId)
            toast.info('Receipt is being processed in background')
          } else {
            toast.error('Unexpected scan response')
            resetState()
          }
        })
        .catch((error) => {
          toast.error(error.data?.message || 'Failed to scan receipt')
          resetState()
        })
    },
    [
      receipt,
      aiScanReceipt,
      startProgress,
      updateProgress,
      completeSuccess,
      resetState,
      stopProgressSimulation
    ]
  )

  return {
    receipt,
    progress,
    handleReceiptUpload
  }
}

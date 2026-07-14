import { useState, useEffect, useCallback, useRef, useEffectEvent } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScanText } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { AIScanReceiptData } from '@/features/transaction/transactionType'
import { toast } from 'sonner'
import { markNotificationHandledInForeground } from '@/features/notification/notificationPresentation'
import { useProgressLoader } from '@/hooks/use-progress-loader'
import {
  useAiScanReceiptMutation,
  useLazyGetReceiptScanStatusQuery
} from '@/features/transaction/transactionAPI'
import { useSocket } from '@/hooks/use-socket'

interface ReceiptScannerProps {
  loadingChange: boolean
  onScanComplete: (data: AIScanReceiptData) => void
  onLoadingChange: (isLoading: boolean) => void
}

const PENDING_RECEIPT_JOB_KEY = 'finsight:pending-receipt-job'

const ReceiptScanner = ({
  loadingChange,
  onScanComplete,
  onLoadingChange
}: ReceiptScannerProps) => {
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
  const [pendingJobId, setPendingJobIdState] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  const resetState = useCallback(() => {
    stopProgressSimulation()
    stopSafetyTimeout()
    stopCompletionTimeout()
    resetProgress()
    if (receipt && receipt.startsWith('blob:')) {
      URL.revokeObjectURL(receipt)
    }
    setReceipt(null)
    pendingJobIdRef.current = null
    setPendingJobIdState(null)
    sessionStorage.removeItem(PENDING_RECEIPT_JOB_KEY)
    onLoadingChange(false)
  }, [
    receipt,
    resetProgress,
    onLoadingChange,
    stopProgressSimulation,
    stopSafetyTimeout,
    stopCompletionTimeout
  ])

  const completeSuccess = useCallback(() => {
    stopProgressSimulation()
    stopSafetyTimeout()
    stopCompletionTimeout()
    pendingJobIdRef.current = null
    setPendingJobIdState(null)
    sessionStorage.removeItem(PENDING_RECEIPT_JOB_KEY)
    updateProgress(100)
    // Settle for a bit before clearing UI
    completionTimeoutRef.current = setTimeout(() => {
      doneProgress()
      if (receipt && receipt.startsWith('blob:')) {
        URL.revokeObjectURL(receipt)
      }
      setReceipt(null)
      onLoadingChange(false)
    }, 500)
  }, [
    receipt,
    doneProgress,
    updateProgress,
    onLoadingChange,
    stopProgressSimulation,
    stopSafetyTimeout,
    stopCompletionTimeout
  ])

  const notifyLoadingChange = useEffectEvent((isLoading: boolean) => {
    onLoadingChange(isLoading)
  })

  const completeScan = useEffectEvent((data: AIScanReceiptData) => {
    onScanComplete(data)
  })

  const clearPendingJob = useEffectEvent(() => {
    pendingJobIdRef.current = null
    setPendingJobIdState(null)
    sessionStorage.removeItem(PENDING_RECEIPT_JOB_KEY)
  })

  const resetScanState = useEffectEvent(() => {
    resetState()
  })

  const completeScanSuccess = useEffectEvent(() => {
    completeSuccess()
  })

  useEffect(() => {
    const storedJobId = sessionStorage.getItem(PENDING_RECEIPT_JOB_KEY)
    if (!storedJobId) return

    pendingJobIdRef.current = storedJobId
    setPendingJobIdState(storedJobId)
    notifyLoadingChange(true)
    startProgress(10)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent keeps latest onLoadingChange without resubscribing restore logic.
  }, [startProgress])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      stopProgressSimulation()
      stopSafetyTimeout()
      stopCompletionTimeout()
    }
  }, [stopProgressSimulation, stopSafetyTimeout, stopCompletionTimeout])

  // Revoke old blob URL when receipt changes or on unmount
  useEffect(() => {
    return () => {
      if (receipt && receipt.startsWith('blob:')) {
        URL.revokeObjectURL(receipt)
      }
    }
  }, [receipt])

  // Listen for background scan events
  useEffect(() => {
    if (!socket) return

    const handleSuccess = (payload: {
      jobId: string
      data: AIScanReceiptData
    }) => {
      // Ignore if no job is pending (e.g., timed out) or if jobId doesn't match
      if (!pendingJobIdRef.current || payload.jobId !== pendingJobIdRef.current)
        return

      clearPendingJob()
      try {
        markNotificationHandledInForeground(payload.jobId)
        completeScan(payload.data)
        toast.success('Receipt scanned successfully')
        completeScanSuccess()
      } catch (error) {
        console.error('❌ [Scanner] Failed to complete scan', error)
        toast.error('Scan completed but UI update failed')
        completeScanSuccess()
      }
    }

    const handleFailure = (payload: { jobId: string; error: string }) => {
      if (!pendingJobIdRef.current || payload.jobId !== pendingJobIdRef.current)
        return

      markNotificationHandledInForeground(payload.jobId)
      toast.error(payload.error || 'Failed to scan receipt')
      resetScanState()
    }

    socket.on('receipt:scan-completed', handleSuccess)
    socket.on('receipt:scan-failed', handleFailure)

    return () => {
      socket.off('receipt:scan-completed', handleSuccess)
      socket.off('receipt:scan-failed', handleFailure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effect events keep latest handlers while the socket subscription depends only on socket.
  }, [socket])

  useEffect(() => {
    if (!pendingJobId) return

    let cancelled = false
    stopSafetyTimeout()
    timeoutRef.current = setTimeout(() => {
      toast.error(
        'Processing timed out. Please check your internet or try again'
      )
      resetScanState()
    }, 60000)

    const checkStatus = async () => {
      try {
        const response = await getReceiptScanStatus(pendingJobId).unwrap()
        if (cancelled || pendingJobIdRef.current !== pendingJobId) return

        if (response.data.status === 'completed' && response.data.receipt) {
          clearPendingJob()
          markNotificationHandledInForeground(pendingJobId)
          completeScan(response.data.receipt)
          toast.success('Receipt scanned successfully')
          completeScanSuccess()
        } else if (response.data.status === 'completed') {
          toast.error(
            'Receipt result is no longer available. Please scan again'
          )
          resetScanState()
        } else if (response.data.status === 'failed') {
          markNotificationHandledInForeground(pendingJobId)
          toast.error(
            response.data.error || 'Receipt processing failed. Please try again'
          )
          resetScanState()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effect events keep latest completion/reset callbacks without restarting polling.
  }, [pendingJobId, getReceiptScanStatus, stopSafetyTimeout])

  const handleReceiptUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      toast.error('Please select a file')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Cleanup old preview
    if (receipt && receipt.startsWith('blob:')) {
      URL.revokeObjectURL(receipt)
    }

    const previewUrl = URL.createObjectURL(file)
    setReceipt(previewUrl)

    const formData = new FormData()
    formData.append('receipt', file)

    startProgress(10)
    onLoadingChange(true)

    // Simulate scanning progress
    let currentProgress = 10
    stopProgressSimulation()
    intervalRef.current = setInterval(() => {
      // Slow down as we get closer to 90
      const increment =
        currentProgress < 70 ? 5 : currentProgress < 85 ? 1 : 0.5
      currentProgress = Math.min(currentProgress + increment, 90)
      updateProgress(Math.floor(currentProgress))
    }, 500) // Slightly slower interval to reduce rerenders

    aiScanReceipt(formData)
      .unwrap()
      .then((res) => {
        if (res.data?.receipt) {
          onScanComplete(res.data.receipt)
          toast.success('Receipt scanned successfully')
          completeSuccess()
        } else if (res.data?.jobId) {
          pendingJobIdRef.current = res.data.jobId
          setPendingJobIdState(res.data.jobId)
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
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">AI Scan Receipt</Label>
      <div className="flex items-start gap-3 border-b pb-4">
        {/* Receipt Preview */}
        <div
          className={`h-12 w-12 rounded-md border bg-cover bg-center ${
            !receipt ? 'bg-muted' : ''
          }`}
          style={receipt ? { backgroundImage: `url(${receipt})` } : {}}
          role="img"
          aria-label={receipt ? 'Receipt preview' : 'No receipt uploaded'}
        >
          {!receipt && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ScanText color="currentColor" className="h-5 w-5 !stroke-1.5" />
            </div>
          )}
        </div>

        {/* Upload Input or Progress */}
        <div className="flex-1">
          {!loadingChange ? (
            <>
              <Input
                type="file"
                accept="image/*"
                onChange={handleReceiptUpload}
                aria-label="Upload receipt image"
                aria-describedby="receipt-file-restrictions"
                className="max-w-[250px] px-1 h-9 cursor-pointer file:cursor-pointer text-sm file:mr-2 
            file:rounded file:border-0 file:bg-primary file:px-3 file:py-px
             file:text-sm file:font-medium file:text-white 
             hover:file:bg-primary/90"
                disabled={loadingChange}
              />
              <p
                id="receipt-file-restrictions"
                className="mt-2 text-[11px] px-2 text-muted-foreground"
              >
                JPG, PNG up to 5MB
              </p>
            </>
          ) : (
            <div className="space-y-2 pt-3" role="status" aria-live="polite">
              <Progress value={progress} className="h-2 w-[250px]" />
              <p className="text-xs text-muted-foreground" aria-atomic="true">
                Scanning receipt... {progress}%
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReceiptScanner

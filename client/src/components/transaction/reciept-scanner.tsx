import { useState, useEffect, useCallback, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScanText } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { AIScanReceiptData } from '@/features/transaction/transationType'
import { toast } from 'sonner'
import { useProgressLoader } from '@/hooks/use-progress-loader'
import { useAiScanReceiptMutation } from '@/features/transaction/transactionAPI'
import { useSocket } from '@/hooks/use-socket'

interface ReceiptScannerProps {
  loadingChange: boolean
  onScanComplete: (data: AIScanReceiptData) => void
  onLoadingChange: (isLoading: boolean) => void
}

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
  const socket = useSocket()
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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

  const resetState = useCallback(() => {
    stopProgressSimulation()
    stopSafetyTimeout()
    resetProgress()
    setReceipt(null)
    setPendingJobId(null)
    onLoadingChange(false)
  }, [resetProgress, onLoadingChange, stopProgressSimulation, stopSafetyTimeout])

  const completeSuccess = useCallback(() => {
    stopProgressSimulation()
    stopSafetyTimeout()
    updateProgress(100)
    // Settle for a bit before clearing UI
    setTimeout(() => {
      doneProgress()
      setReceipt(null)
      setPendingJobId(null)
      onLoadingChange(false)
    }, 500)
  }, [
    doneProgress,
    updateProgress,
    onLoadingChange,
    stopProgressSimulation,
    stopSafetyTimeout
  ])

  // Listen for background scan events
  useEffect(() => {
    if (!socket) return

    const handleSuccess = (payload: { jobId: string; data: AIScanReceiptData }) => {
      // Ignore if no job is pending (e.g., timed out) or if jobId doesn't match
      if (!pendingJobId || payload.jobId !== pendingJobId) return

      onScanComplete(payload.data)
      toast.success('Receipt scanned successfully')
      completeSuccess()
    }

    const handleFailure = (payload: { jobId: string; error: string }) => {
      if (!pendingJobId || payload.jobId !== pendingJobId) return

      toast.error(payload.error || 'Failed to scan receipt')
      resetState()
    }

    socket.on('receipt:scan-completed', handleSuccess)
    socket.on('receipt:scan-failed', handleFailure)

    return () => {
      socket.off('receipt:scan-completed', handleSuccess)
      socket.off('receipt:scan-failed', handleFailure)
    }
  }, [socket, onScanComplete, completeSuccess, resetState, pendingJobId])

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
    const formData = new FormData()
    formData.append('receipt', file)

    startProgress(10)
    onLoadingChange(true)
    // Simulate file upload and processing
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setReceipt(result)

      // Simulate scanning progress
      let currentProgress = 10
      stopProgressSimulation()
      intervalRef.current = setInterval(() => {
        // Slow down as we get closer to 90
        const increment = currentProgress < 70 ? 5 : currentProgress < 85 ? 1 : 0.5
        currentProgress = Math.min(currentProgress + increment, 90)
        updateProgress(Math.floor(currentProgress))
      }, 300)

      aiScanReceipt(formData)
        .unwrap()
        .then((res) => {
          if (res.jobId) {
            setPendingJobId(res.jobId)
            toast.info('Receipt is being processed in background')

            // [CodeRabbit] Safety Timeout: Fallback if socket event never arrives
            stopSafetyTimeout()
            timeoutRef.current = setTimeout(() => {
              toast.error('Processing timed out. Please check your internet or try again.')
              resetState()
            }, 60000) // 60 seconds
          } else if (res.data) {
            // Sync mode fallback: Populate immediately
            onScanComplete(res.data)
            toast.success('Receipt scanned successfully')
            completeSuccess()
          }
        })
        .catch((error) => {
          toast.error(error.data?.message || 'Failed to scan receipt')
          resetState()
        })
    }
    reader.readAsDataURL(file)
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
                className="max-w-[250px] px-1 h-9 cursor-pointer file:cursor-pointer text-sm file:mr-2 
            file:rounded file:border-0 file:bg-primary file:px-3 file:py-px
             file:text-sm file:font-medium file:text-white 
             hover:file:bg-primary/90"
                disabled={loadingChange}
              />
              <p className="mt-2 text-[11px] px-2 text-muted-foreground">
                JPG, PNG up to 5MB
              </p>
            </>
          ) : (
            <div className="space-y-2 pt-3">
              <Progress value={progress} className="h-2 w-[250px]" />
              <p className="text-xs text-muted-foreground">
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

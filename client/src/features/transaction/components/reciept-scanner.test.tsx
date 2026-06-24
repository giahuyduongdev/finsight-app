import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReceiptScanner from './reciept-scanner'

type SocketHandler = (payload: unknown) => void

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  scanReceipt: vi.fn(),
  handlers: {} as Record<string, SocketHandler>,
  socket: {
    on: vi.fn(),
    off: vi.fn()
  },
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  },
  startProgress: vi.fn(),
  updateProgress: vi.fn(),
  doneProgress: vi.fn(),
  resetProgress: vi.fn()
}))

vi.mock('@/features/transaction/transactionAPI', () => ({
  useAiScanReceiptMutation: () => [mocks.scanReceipt],
  useLazyGetReceiptScanStatusQuery: () => [mocks.getStatus]
}))

vi.mock('@/hooks/use-socket', () => ({
  useSocket: () => mocks.socket
}))

vi.mock('@/hooks/use-progress-loader', () => ({
  useProgressLoader: () => ({
    progress: 10,
    startProgress: mocks.startProgress,
    updateProgress: mocks.updateProgress,
    doneProgress: mocks.doneProgress,
    resetProgress: mocks.resetProgress
  })
}))

vi.mock('sonner', () => ({
  toast: mocks.toast
}))

describe('ReceiptScanner recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mocks.handlers = {}
    mocks.socket.on.mockImplementation(
      (event: string, handler: SocketHandler) => {
        mocks.handlers[event] = handler
        return mocks.socket
      }
    )
    mocks.socket.off.mockImplementation(() => mocks.socket)
  })

  it('restores a pending job and completes through status polling', async () => {
    const receipt = {
      title: 'Coffee',
      amount: 5,
      currency: 'USD'
    }
    sessionStorage.setItem(
      'finsight:pending-receipt-job',
      'receipt-scan-user-hash'
    )
    mocks.getStatus.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            jobId: 'receipt-scan-user-hash',
            status: 'completed',
            receipt
          }
        })
    })
    const onScanComplete = vi.fn()
    const onLoadingChange = vi.fn()

    render(
      <ReceiptScanner
        loadingChange
        onScanComplete={onScanComplete}
        onLoadingChange={onLoadingChange}
      />
    )

    await waitFor(() => {
      expect(onScanComplete).toHaveBeenCalledWith(receipt)
    })
    expect(mocks.getStatus).toHaveBeenCalledWith('receipt-scan-user-hash')
    expect(sessionStorage.getItem('finsight:pending-receipt-job')).toBeNull()
    expect(onLoadingChange).toHaveBeenCalledWith(true)
  })

  it('ignores a duplicate socket completion after status recovery', async () => {
    const receipt = {
      title: 'Coffee',
      amount: 5,
      currency: 'USD'
    }
    sessionStorage.setItem(
      'finsight:pending-receipt-job',
      'receipt-scan-user-hash'
    )
    mocks.getStatus.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            jobId: 'receipt-scan-user-hash',
            status: 'completed',
            receipt
          }
        })
    })
    const onScanComplete = vi.fn()

    render(
      <ReceiptScanner
        loadingChange
        onScanComplete={onScanComplete}
        onLoadingChange={vi.fn()}
      />
    )

    await waitFor(() => expect(onScanComplete).toHaveBeenCalledTimes(1))
    mocks.handlers['receipt:scan-completed']?.({
      jobId: 'receipt-scan-user-hash',
      data: receipt
    })
    expect(onScanComplete).toHaveBeenCalledTimes(1)
  })
})

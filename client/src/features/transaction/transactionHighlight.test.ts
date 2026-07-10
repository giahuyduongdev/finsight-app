import { describe, expect, it, vi } from 'vitest'
import {
  getTransactionHighlightClassName,
  requestTransactionHighlight,
  TRANSACTION_HIGHLIGHT_DURATION_MS,
  TRANSACTION_HIGHLIGHT_EVENT,
  TRANSACTION_HIGHLIGHT_STORAGE_KEY
} from './transactionHighlight'
import { TransactionType } from './transactionType'

const transaction = {
  _id: 'transaction-123',
  userId: 'user-123',
  title: 'Created transaction',
  type: 'EXPENSE',
  amount: 25,
  currency: 'USD',
  description: '',
  category: 'Food',
  date: '2026-07-08T00:00:00.000Z',
  isRecurring: false,
  recurringInterval: null,
  nextRecurringDate: null,
  lastProcessed: null,
  status: 'COMPLETED',
  paymentMethod: 'CARD',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z'
} as TransactionType

describe('transactionHighlight', () => {
  it('uses the approved subtle row treatment for six seconds', () => {
    const className = getTransactionHighlightClassName(true)

    expect(TRANSACTION_HIGHLIGHT_DURATION_MS).toBe(6000)
    expect(className).toContain('bg-emerald-50')
    expect(className).toContain('border-l-4')
    expect(className).toContain('border-l-emerald-500')
    expect(className).not.toContain('ring-')
    expect(getTransactionHighlightClassName(false)).toBeUndefined()
  })

  it('stores and dispatches the highlighted transaction', () => {
    const handler = vi.fn()
    window.addEventListener(TRANSACTION_HIGHLIGHT_EVENT, handler)

    requestTransactionHighlight(transaction)

    expect(sessionStorage.getItem(TRANSACTION_HIGHLIGHT_STORAGE_KEY)).toBe(
      transaction._id
    )
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0]).toMatchObject({
      detail: {
        transactionId: transaction._id,
        transaction
      }
    })

    window.removeEventListener(TRANSACTION_HIGHLIGHT_EVENT, handler)
  })
})

import { TransactionType } from './transactionType'

export const TRANSACTION_HIGHLIGHT_QUERY_PARAM = 'highlight'
export const TRANSACTION_HIGHLIGHT_STORAGE_KEY =
  'finsight:pending-transaction-highlight'
export const TRANSACTION_HIGHLIGHT_EVENT = 'transaction:highlight-requested'
export const TRANSACTION_HIGHLIGHT_DURATION_MS = 6000

const TRANSACTION_HIGHLIGHT_CLASS_NAME =
  'bg-emerald-50/80 border-l-4 border-l-emerald-500 transition-colors duration-700 hover:bg-emerald-50/80'

export const getTransactionHighlightClassName = (isHighlighted: boolean) =>
  isHighlighted ? TRANSACTION_HIGHLIGHT_CLASS_NAME : undefined

export type TransactionHighlightEvent = CustomEvent<{
  transactionId: string
  transaction?: TransactionType
}>

export const requestTransactionHighlight = (transaction: TransactionType) => {
  if (typeof window === 'undefined') return

  const transactionId = transaction._id

  window.sessionStorage.setItem(
    TRANSACTION_HIGHLIGHT_STORAGE_KEY,
    transactionId
  )
  window.dispatchEvent(
    new CustomEvent(TRANSACTION_HIGHLIGHT_EVENT, {
      detail: { transactionId, transaction }
    })
  )
}

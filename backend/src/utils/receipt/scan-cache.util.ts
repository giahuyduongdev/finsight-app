import crypto from 'crypto'
import { Env } from '../../config/env.config'

export type CachedReceiptScanData = {
  title: string
  amount: number
  currency: string
  date: string
  description: string
  category: string
  paymentMethod: string
  type: 'INCOME' | 'EXPENSE'
  status: string
  receiptUrl: string
}

export type CachedReceiptScan = {
  data: CachedReceiptScanData
  cachedAt: string
}

const DEFAULT_RECEIPT_SCAN_CACHE_TTL_SECONDS = 24 * 3600

export const getReceiptScanCacheTtlSeconds = () => {
  const ttl = Number(Env.RECEIPT_SCAN_CACHE_TTL_SECONDS)
  return Number.isInteger(ttl) && ttl > 0
    ? ttl
    : DEFAULT_RECEIPT_SCAN_CACHE_TTL_SECONDS
}

export const hashReceiptImage = (buffer: Buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex')

export const getReceiptScanCacheKey = (userId: string, imageHash: string) =>
  `receipt:scan-cache:${userId}:${imageHash}`

export const getReceiptCloudinaryPublicId = (
  userId: string,
  imageHash: string
) => `receipts/${userId}/${imageHash}`

export const parseCachedReceiptScan = (
  value: string | null
): CachedReceiptScan | null => {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as CachedReceiptScan
    if (!parsed?.data?.receiptUrl) return null
    return parsed
  } catch {
    return null
  }
}

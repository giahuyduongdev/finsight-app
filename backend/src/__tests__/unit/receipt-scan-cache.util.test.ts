import { Env } from '../../config/env.config'
import {
  getReceiptCloudinaryPublicId,
  getReceiptScanCacheKey,
  getReceiptScanCacheTtlSeconds,
  hashReceiptImage,
  parseCachedReceiptScan
} from '../../utils/receipt/scan-cache.util'

describe('receipt-scan-cache.util', () => {
  const originalTtl = Env.RECEIPT_SCAN_CACHE_TTL_SECONDS

  afterEach(() => {
    Env.RECEIPT_SCAN_CACHE_TTL_SECONDS = originalTtl
  })

  it('should build stable user-scoped cache and Cloudinary keys', () => {
    const imageHash = hashReceiptImage(Buffer.from('compressed image'))

    expect(imageHash).toBe(
      '5b940700925ddaa8ad02412506cc2b00b7f22bf50dcdc9e4da69ea6404d8be40'
    )
    expect(getReceiptScanCacheKey('user-123', imageHash)).toBe(
      `receipt:scan-cache:user-123:${imageHash}`
    )
    expect(getReceiptCloudinaryPublicId('user-123', imageHash)).toBe(
      `receipts/user-123/${imageHash}`
    )
  })

  it('should parse cached receipt data only when receiptUrl exists', () => {
    const cachedReceipt = {
      data: {
        title: 'Coffee',
        amount: 5,
        currency: 'USD',
        date: '2026-05-25',
        description: 'Morning coffee',
        category: 'Food',
        paymentMethod: 'CASH',
        type: 'EXPENSE',
        status: 'COMPLETED',
        receiptUrl: 'https://res.cloudinary.com/demo/receipt.jpg'
      },
      cachedAt: '2026-05-25T00:00:00.000Z'
    }

    expect(parseCachedReceiptScan(JSON.stringify(cachedReceipt))).toEqual(
      cachedReceipt
    )
    expect(parseCachedReceiptScan(null)).toBeNull()
    expect(parseCachedReceiptScan('not-json')).toBeNull()
    expect(
      parseCachedReceiptScan(JSON.stringify({ data: { title: 'Missing URL' } }))
    ).toBeNull()
  })

  it('should use configured positive TTL and fall back to 24 hours otherwise', () => {
    Env.RECEIPT_SCAN_CACHE_TTL_SECONDS = '3600'
    expect(getReceiptScanCacheTtlSeconds()).toBe(3600)

    Env.RECEIPT_SCAN_CACHE_TTL_SECONDS = '3600.5'
    expect(getReceiptScanCacheTtlSeconds()).toBe(86400)

    Env.RECEIPT_SCAN_CACHE_TTL_SECONDS = '0'
    expect(getReceiptScanCacheTtlSeconds()).toBe(86400)

    Env.RECEIPT_SCAN_CACHE_TTL_SECONDS = '-1'
    expect(getReceiptScanCacheTtlSeconds()).toBe(86400)

    Env.RECEIPT_SCAN_CACHE_TTL_SECONDS = 'invalid'
    expect(getReceiptScanCacheTtlSeconds()).toBe(86400)
  })
})

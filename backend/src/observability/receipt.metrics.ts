import { Counter } from 'prom-client'
import { metricsRegistry } from './metrics.registry'

const receiptCache = new Counter({
  name: 'finsight_receipt_cache_total',
  help: 'Receipt cache lookup outcomes',
  labelNames: ['result'] as const,
  registers: [metricsRegistry]
})

const receiptScans = new Counter({
  name: 'finsight_receipt_scans_total',
  help: 'Receipt scan outcomes',
  labelNames: ['outcome'] as const,
  registers: [metricsRegistry]
})

export const recordReceiptCache = (
  result: 'hit' | 'miss' | 'corrupt' | 'write_error'
) => receiptCache.inc({ result })

export const recordReceiptScan = (
  outcome: 'accepted' | 'succeeded' | 'skipped' | 'failed'
) => receiptScans.inc({ outcome })

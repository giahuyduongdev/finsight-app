describe('receipt configuration', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.resetModules()
  })

  it('uses the approved defaults', async () => {
    delete process.env.RECEIPT_WORKER_CONCURRENCY
    delete process.env.RECEIPT_AI_RATE_LIMIT_MAX
    delete process.env.RECEIPT_AI_RATE_LIMIT_DURATION_MS
    jest.resetModules()

    const { receiptConfig } = await import('../../config/receipt.config')

    expect(receiptConfig.workerConcurrency).toBe(2)
    expect(receiptConfig.aiRateLimitMax).toBe(10)
    expect(receiptConfig.aiRateLimitDurationMs).toBe(60000)
  })

  it('falls back safely for invalid numeric values', async () => {
    process.env.RECEIPT_WORKER_CONCURRENCY = '0'
    process.env.RECEIPT_MAX_ATTEMPTS = 'NaN'
    process.env.RECEIPT_DOWNLOAD_TIMEOUT_MS = '-1'
    jest.resetModules()

    const { receiptConfig } = await import('../../config/receipt.config')

    expect(receiptConfig.workerConcurrency).toBe(2)
    expect(receiptConfig.maxAttempts).toBe(3)
    expect(receiptConfig.downloadTimeoutMs).toBe(10000)
  })
})

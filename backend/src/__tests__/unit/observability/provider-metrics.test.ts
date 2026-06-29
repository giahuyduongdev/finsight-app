describe('provider metrics', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('records successful provider calls', async () => {
    const { metricsRegistry, observeProviderCall } =
      await import('../../../observability')

    await expect(
      observeProviderCall(
        { provider: 'gemini', operation: 'receipt_extract' },
        async () => 'ok'
      )
    ).resolves.toBe('ok')

    const metrics = await metricsRegistry.metrics()
    expect(metrics).toContain('provider="gemini"')
    expect(metrics).toContain('operation="receipt_extract"')
    expect(metrics).toContain('outcome="success"')
  })

  it('classifies errors and rethrows the original instance', async () => {
    const { metricsRegistry, observeProviderCall } =
      await import('../../../observability')
    const error = new Error('429 RESOURCE_EXHAUSTED')

    await expect(
      observeProviderCall(
        { provider: 'gemini', operation: 'receipt_extract' },
        async () => {
          throw error
        }
      )
    ).rejects.toBe(error)

    const metrics = await metricsRegistry.metrics()
    expect(metrics).toContain('outcome="error"')
    expect(metrics).toContain('error_class="rate_limit"')
    expect(metrics).not.toContain('RESOURCE_EXHAUSTED')
  })
})

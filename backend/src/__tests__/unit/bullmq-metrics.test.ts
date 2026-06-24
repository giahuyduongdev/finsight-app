describe('BullMQ metrics', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('records bounded queue lifecycle outcomes and durations', async () => {
    const {
      metricsRegistry,
      recordBullMQJobOutcome,
      observeBullMQJobProcessing,
      observeBullMQJobWait
    } = await import('../../observability')

    recordBullMQJobOutcome({
      queue: 'receipt',
      jobName: 'scan_receipt',
      outcome: 'skipped'
    })
    observeBullMQJobWait('receipt', 'scan_receipt', 0.25)
    observeBullMQJobProcessing('receipt', 'scan_receipt', 'skipped', 1.5)

    const metrics = await metricsRegistry.metrics()
    expect(metrics).toContain('queue="receipt"')
    expect(metrics).toContain('job_name="scan_receipt"')
    expect(metrics).toContain('outcome="skipped"')
  })

  it('updates queue depth without exposing job identifiers', async () => {
    const { collectBullMQQueueDepth, metricsRegistry } =
      await import('../../observability')
    const queue = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 4,
        active: 2,
        delayed: 1,
        failed: 3
      })
    }

    await collectBullMQQueueDepth('receipt', queue)

    const metrics = await metricsRegistry.metrics()
    expect(metrics).toContain('state="waiting"} 4')
    expect(metrics).toContain('state="active"} 2')
    expect(metrics).not.toContain('jobId')
  })
})

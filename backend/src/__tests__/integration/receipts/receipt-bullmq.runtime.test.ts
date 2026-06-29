import { Queue, QueueEvents, Worker } from 'bullmq'
import Redis from 'ioredis'

const integrationUrl = process.env.REDIS_INTEGRATION_URL
const describeWithRedis = integrationUrl ? describe : describe.skip
const connections: Redis[] = []

const createConnection = () => {
  const connection = new Redis(integrationUrl!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  })
  connections.push(connection)
  return connection
}

describeWithRedis('Receipt BullMQ runtime integration', () => {
  const resources: Array<{ close: () => Promise<unknown> }> = []

  afterEach(async () => {
    await Promise.allSettled(
      resources
        .splice(0)
        .reverse()
        .map((resource) => resource.close())
    )
    connections.splice(0).forEach((connection) => connection.disconnect())
  })

  it('deduplicates concurrent intake by stable job ID', async () => {
    const queueName = `receipt-dedup-${Date.now()}`
    const queue = new Queue(queueName, { connection: createConnection() })
    resources.push(queue)

    const jobId = 'receipt-scan-user-hash'
    const jobs = await Promise.all(
      Array.from({ length: 6 }, () =>
        queue.add(
          'scan-receipt',
          { userId: 'user', imageUrl: 'https://example.test/receipt.jpg' },
          { jobId }
        )
      )
    )

    expect(new Set(jobs.map((job) => job.id))).toEqual(new Set([jobId]))
    expect(await queue.getJobCounts('waiting')).toEqual(
      expect.objectContaining({ waiting: 1 })
    )
    await queue.obliterate({ force: true })
  })

  it('never processes more than configured concurrency', async () => {
    const queueName = `receipt-concurrency-${Date.now()}`
    const queue = new Queue(queueName, { connection: createConnection() })
    const queueEvents = new QueueEvents(queueName, {
      connection: createConnection()
    })
    let active = 0
    let maxActive = 0
    const worker = new Worker(
      queueName,
      async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 75))
        active -= 1
      },
      {
        connection: createConnection(),
        concurrency: 2
      }
    )
    resources.push(worker, queueEvents, queue)
    await queueEvents.waitUntilReady()
    await worker.waitUntilReady()

    const jobs = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        queue.add('scan-receipt', { index })
      )
    )
    await Promise.all(
      jobs.map((job) => job.waitUntilFinished(queueEvents, 10000))
    )

    expect(maxActive).toBe(2)
    await queue.obliterate({ force: true })
  })

  it('processes a durable waiting job after a worker starts', async () => {
    const queueName = `receipt-restart-${Date.now()}`
    const queue = new Queue(queueName, { connection: createConnection() })
    const queueEvents = new QueueEvents(queueName, {
      connection: createConnection()
    })
    resources.push(queueEvents, queue)
    await queueEvents.waitUntilReady()

    const job = await queue.add('scan-receipt', {
      userId: 'user',
      imageUrl: 'https://example.test/receipt.jpg'
    })
    expect(await job.getState()).toBe('waiting')

    const worker = new Worker(
      queueName,
      async (queuedJob) => ({ processedJobId: queuedJob.id }),
      { connection: createConnection(), concurrency: 2 }
    )
    resources.unshift(worker)
    await worker.waitUntilReady()

    await expect(job.waitUntilFinished(queueEvents, 10000)).resolves.toEqual({
      processedJobId: job.id
    })
    await queue.obliterate({ force: true })
  })
})

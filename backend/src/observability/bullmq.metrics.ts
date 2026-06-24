import { Counter, Gauge, Histogram } from 'prom-client'
import { metricsRegistry } from './metrics.registry'

export type BullMQJobOutcome =
  | 'enqueued'
  | 'completed'
  | 'skipped'
  | 'retrying'
  | 'permanent_failure'
  | 'final_failure'

type QueueCountsReader = {
  getJobCounts: (
    ...types: Array<'waiting' | 'active' | 'delayed' | 'failed'>
  ) => Promise<Record<string, number>>
}

const bullMQJobs = new Counter({
  name: 'finsight_bullmq_jobs_total',
  help: 'BullMQ job lifecycle outcomes',
  labelNames: ['queue', 'job_name', 'outcome'] as const,
  registers: [metricsRegistry]
})

const bullMQProcessingDuration = new Histogram({
  name: 'finsight_bullmq_job_processing_seconds',
  help: 'BullMQ job processing duration in seconds',
  labelNames: ['queue', 'job_name', 'outcome'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [metricsRegistry]
})

const bullMQWaitDuration = new Histogram({
  name: 'finsight_bullmq_job_wait_seconds',
  help: 'BullMQ job queue wait duration in seconds',
  labelNames: ['queue', 'job_name'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [metricsRegistry]
})

const bullMQQueueJobs = new Gauge({
  name: 'finsight_bullmq_queue_jobs',
  help: 'Current BullMQ queue jobs by state',
  labelNames: ['queue', 'state'] as const,
  registers: [metricsRegistry]
})

const bullMQWorkerErrors = new Counter({
  name: 'finsight_bullmq_worker_errors_total',
  help: 'BullMQ worker infrastructure errors',
  labelNames: ['queue', 'error_class'] as const,
  registers: [metricsRegistry]
})

export const recordBullMQJobOutcome = ({
  queue,
  jobName,
  outcome
}: {
  queue: string
  jobName: string
  outcome: BullMQJobOutcome
}) => {
  bullMQJobs.inc({
    queue,
    job_name: jobName,
    outcome
  })
}

export const observeBullMQJobProcessing = (
  queue: string,
  jobName: string,
  outcome: BullMQJobOutcome,
  durationSeconds: number
) => {
  bullMQProcessingDuration.observe(
    { queue, job_name: jobName, outcome },
    durationSeconds
  )
}

export const observeBullMQJobWait = (
  queue: string,
  jobName: string,
  durationSeconds: number
) => {
  bullMQWaitDuration.observe(
    { queue, job_name: jobName },
    Math.max(durationSeconds, 0)
  )
}

export const recordBullMQWorkerError = (queue: string, errorClass: string) => {
  bullMQWorkerErrors.inc({ queue, error_class: errorClass })
}

export const collectBullMQQueueDepth = async (
  queueName: string,
  queue: QueueCountsReader
) => {
  const states = ['waiting', 'active', 'delayed', 'failed'] as const
  const counts = await queue.getJobCounts(...states)

  for (const state of states) {
    bullMQQueueJobs.set({ queue: queueName, state }, Number(counts[state] ?? 0))
  }
}

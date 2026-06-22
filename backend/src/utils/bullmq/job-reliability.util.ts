import { Job } from 'bullmq'

export type JobOutcome =
  | {
      status: 'succeeded'
      details?: Record<string, unknown>
    }
  | {
      status: 'skipped'
      reason: string
      details?: Record<string, unknown>
    }

export type JobAttemptContext = {
  attemptsMade: number
  maxAttempts: number
  isFinalAttempt: boolean
}

export const getJobAttemptContext = (job: Job): JobAttemptContext => {
  const attemptsMade = job.attemptsMade ?? 0
  const maxAttempts = job.opts.attempts ?? 1

  return {
    attemptsMade,
    maxAttempts,
    isFinalAttempt: attemptsMade >= maxAttempts
  }
}

export const isFinalAttempt = (job: Job): boolean =>
  getJobAttemptContext(job).isFinalAttempt

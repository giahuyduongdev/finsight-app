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

export const getSafeJobErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)

  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .slice(0, 500)
}

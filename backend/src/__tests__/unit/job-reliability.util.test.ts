import {
  getSafeJobErrorMessage,
  getJobAttemptContext,
  isFinalAttempt
} from '../../utils/bullmq/job-reliability.util'

describe('job reliability semantics', () => {
  it('treats the current failure as retryable while attempts remain', () => {
    const job = {
      attemptsMade: 1,
      opts: { attempts: 3 }
    }

    expect(getJobAttemptContext(job as never)).toEqual({
      attemptsMade: 1,
      maxAttempts: 3,
      isFinalAttempt: false
    })
    expect(isFinalAttempt(job as never)).toBe(false)
  })

  it('treats the current failure as final after all attempts are consumed', () => {
    const job = {
      attemptsMade: 3,
      opts: { attempts: 3 }
    }

    expect(getJobAttemptContext(job as never)).toEqual({
      attemptsMade: 3,
      maxAttempts: 3,
      isFinalAttempt: true
    })
    expect(isFinalAttempt(job as never)).toBe(true)
  })

  it('defaults jobs without an attempts option to a single attempt', () => {
    const job = {
      attemptsMade: 1,
      opts: {}
    }

    expect(getJobAttemptContext(job as never)).toEqual({
      attemptsMade: 1,
      maxAttempts: 1,
      isFinalAttempt: true
    })
  })

  it('redacts email addresses and bounds persisted error messages', () => {
    const error = new Error(
      `Delivery to user@example.com failed: ${'x'.repeat(600)}`
    )

    const message = getSafeJobErrorMessage(error)

    expect(message).not.toContain('user@example.com')
    expect(message).toContain('[REDACTED_EMAIL]')
    expect(message.length).toBeLessThanOrEqual(500)
  })
})

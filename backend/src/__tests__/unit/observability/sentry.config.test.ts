import { Request } from 'express'

const initMock = jest.fn()
const expressIntegrationMock = jest.fn(() => ({ name: 'express' }))
const withScopeMock = jest.fn()
const captureExceptionMock = jest.fn()

jest.mock('@sentry/node', () => ({
  init: initMock,
  expressIntegration: expressIntegrationMock,
  withScope: withScopeMock,
  captureException: captureExceptionMock
}))

jest.mock('../../../config/logger.config', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

describe('sentry.config', () => {
  const originalDsn = process.env.SENTRY_DSN
  const originalNodeEnv = process.env.NODE_ENV
  const originalBackgroundEnabled = process.env.SENTRY_BACKGROUND_ERRORS_ENABLED
  const originalTracesSampleRate = process.env.SENTRY_TRACES_SAMPLE_RATE
  const originalRelease = process.env.SENTRY_RELEASE
  const createRequest = (overrides: Partial<Request> = {}): Request =>
    ({
      correlationId: 'req-123',
      path: '/api/test',
      method: 'GET',
      ...overrides
    }) as unknown as Request

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.SENTRY_DSN = 'https://public@example.com/1'
    process.env.NODE_ENV = 'test'
    process.env.SENTRY_BACKGROUND_ERRORS_ENABLED = 'true'
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.25'
    process.env.SENTRY_RELEASE = 'test-release'
  })

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn
    process.env.NODE_ENV = originalNodeEnv
    process.env.SENTRY_BACKGROUND_ERRORS_ENABLED = originalBackgroundEnabled
    process.env.SENTRY_TRACES_SAMPLE_RATE = originalTracesSampleRate
    process.env.SENTRY_RELEASE = originalRelease
  })

  it('initializes Sentry when SENTRY_DSN is configured', async () => {
    const { initSentry } = await import('../../../config/sentry.config')

    initSentry()

    expect(expressIntegrationMock).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://public@example.com/1',
        environment: 'test',
        release: 'test-release',
        tracesSampleRate: 0.25,
        integrations: [{ name: 'express' }]
      })
    )
  })

  it('scrubs sensitive request headers before sending', async () => {
    const { scrubSentryEvent } = await import('../../../config/sentry.config')

    const event = scrubSentryEvent({
      type: undefined,
      request: {
        headers: {
          authorization: 'Bearer token',
          cookie: 'sid=123',
          'set-cookie': 'sid=456',
          'x-api-key': 'secret-key',
          accept: 'application/json'
        }
      }
    })

    expect(event.request?.headers).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      'set-cookie': '[REDACTED]',
      'x-api-key': '[REDACTED]',
      accept: 'application/json'
    })
  })

  it('captures 5xx errors with request context', async () => {
    const setTag = jest.fn()
    const setContext = jest.fn()
    const setUser = jest.fn()
    withScopeMock.mockImplementation((callback) =>
      callback({ setTag, setContext, setUser })
    )
    const { captureSentryError } = await import('../../../config/sentry.config')
    const error = new Error('database down')
    const req = createRequest({ user: { id: 'user-1' } as Request['user'] })

    captureSentryError(error, req, 500)

    expect(withScopeMock).toHaveBeenCalledTimes(1)
    expect(setTag).not.toHaveBeenCalledWith('requestId', 'req-123')
    expect(setContext).toHaveBeenCalledWith('request', {
      requestId: 'req-123',
      path: '/api/test',
      method: 'GET'
    })
    expect(setUser).toHaveBeenCalledWith({ id: 'user-1' })
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
  })

  it('does not capture 4xx errors', async () => {
    const { captureSentryError } = await import('../../../config/sentry.config')

    captureSentryError(
      new Error('bad request'),
      createRequest({ method: 'POST' }),
      400
    )

    expect(withScopeMock).not.toHaveBeenCalled()
    expect(captureExceptionMock).not.toHaveBeenCalled()
  })

  it('does not throw when Sentry capture fails', async () => {
    withScopeMock.mockImplementation(() => {
      throw new Error('sentry unavailable')
    })
    const { captureSentryError } = await import('../../../config/sentry.config')

    expect(() =>
      captureSentryError(new Error('server error'), createRequest(), 500)
    ).not.toThrow()
  })

  it('scrubs receipt data from all supported event surfaces', async () => {
    const { scrubSentryEvent } = await import('../../../config/sentry.config')

    const event = scrubSentryEvent({
      type: undefined,
      request: {
        data: {
          fileBuffer: 'base64-data',
          imageUrl: 'https://cloudinary.example/receipt.jpg',
          title: 'Coffee',
          amount: 120000,
          safe: 'kept'
        },
        query_string: 'token=secret&safe=value',
        cookies: { sid: 'secret' }
      },
      breadcrumbs: [
        {
          data: {
            receiptUrl: 'https://cloudinary.example/private.jpg',
            operation: 'receipt_extract'
          }
        }
      ],
      contexts: {
        receipt: {
          description: 'private purchase',
          outcome: 'failed'
        }
      },
      extra: {
        rawJobPayload: {
          imageHash: 'hash',
          category: 'dining'
        }
      }
    })

    expect(event.request?.data).toEqual({
      fileBuffer: '[REDACTED]',
      imageUrl: '[REDACTED]',
      title: '[REDACTED]',
      amount: '[REDACTED]',
      safe: 'kept'
    })
    expect(event.request?.query_string).toBe('[REDACTED]')
    expect(event.request?.cookies).toEqual({ sid: '[REDACTED]' })
    expect(event.breadcrumbs?.[0].data).toEqual({
      receiptUrl: '[REDACTED]',
      operation: 'receipt_extract'
    })
    expect(event.contexts?.receipt).toEqual({
      description: '[REDACTED]',
      outcome: 'failed'
    })
    expect(event.extra?.rawJobPayload).toBe('[REDACTED]')
  })

  it('scrubs provider URLs and tokens from exception strings', async () => {
    const { scrubSentryEvent } = await import('../../../config/sentry.config')

    const event = scrubSentryEvent({
      type: undefined,
      message:
        'Failed https://res.cloudinary.com/private/receipt.jpg Bearer abc.def',
      exception: {
        values: [
          {
            type: 'Error',
            value:
              'Gemini key AIza123456789012345678901234567890 and https://provider.test/path'
          }
        ]
      },
      breadcrumbs: [
        {
          message: 'Downloaded https://provider.test/private-image'
        }
      ]
    })

    expect(event.message).not.toContain('res.cloudinary.com')
    expect(event.message).not.toContain('abc.def')
    expect(event.exception?.values?.[0].value).not.toContain('AIza')
    expect(event.exception?.values?.[0].value).not.toContain('provider.test')
    expect(event.breadcrumbs?.[0].message).not.toContain('provider.test')
  })

  it('captures allowlisted background terminal failures without raw payloads', async () => {
    const setTag = jest.fn()
    const setContext = jest.fn()
    withScopeMock.mockImplementation((callback) =>
      callback({ setTag, setContext, setUser: jest.fn() })
    )
    const { captureBackgroundError } =
      await import('../../../config/sentry.config')
    const error = new Error('provider failed')

    captureBackgroundError(error, {
      component: 'receipt_worker',
      eventType: 'final_failure',
      queueName: 'receipt',
      attempt: 3,
      maxAttempts: 3,
      correlationId: 'req-123',
      rawJobPayload: { fileBuffer: 'secret' }
    })

    expect(setTag).toHaveBeenCalledWith('component', 'receipt_worker')
    expect(setTag).toHaveBeenCalledWith('eventType', 'final_failure')
    expect(setTag).toHaveBeenCalledWith('queueName', 'receipt')
    expect(setTag).not.toHaveBeenCalledWith('correlationId', 'req-123')
    expect(setContext).toHaveBeenCalledWith(
      'background',
      expect.objectContaining({
        correlationId: 'req-123',
        rawJobPayload: '[REDACTED]'
      })
    )
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
  })

  it('does not capture background errors when disabled', async () => {
    process.env.SENTRY_BACKGROUND_ERRORS_ENABLED = 'false'
    jest.resetModules()

    const { captureBackgroundError } =
      await import('../../../config/sentry.config')

    captureBackgroundError(new Error('ignored'), {
      component: 'receipt_worker',
      eventType: 'retry'
    })

    expect(captureExceptionMock).not.toHaveBeenCalled()
  })
})

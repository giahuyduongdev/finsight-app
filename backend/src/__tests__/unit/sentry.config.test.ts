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

jest.mock('../../config/logger.config', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

describe('sentry.config', () => {
  const originalDsn = process.env.SENTRY_DSN
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
  })

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn
  })

  it('initializes Sentry when SENTRY_DSN is configured', async () => {
    const { initSentry } = await import('../../config/sentry.config')

    initSentry()

    expect(expressIntegrationMock).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://public@example.com/1',
        environment: 'test',
        tracesSampleRate: 1.0,
        integrations: [{ name: 'express' }]
      })
    )
  })

  it('scrubs sensitive request headers before sending', async () => {
    const { scrubSentryEvent } = await import('../../config/sentry.config')

    const event = scrubSentryEvent({
      type: undefined,
      request: {
        headers: {
          authorization: 'Bearer token',
          cookie: 'sid=123',
          'set-cookie': 'sid=456',
          accept: 'application/json'
        }
      }
    })

    expect(event.request?.headers).toEqual({ accept: 'application/json' })
  })

  it('captures 5xx errors with request context', async () => {
    const setTag = jest.fn()
    const setContext = jest.fn()
    const setUser = jest.fn()
    withScopeMock.mockImplementation((callback) =>
      callback({ setTag, setContext, setUser })
    )
    const { captureSentryError } = await import('../../config/sentry.config')
    const error = new Error('database down')
    const req = createRequest({ user: { id: 'user-1' } as Request['user'] })

    captureSentryError(error, req, 500)

    expect(withScopeMock).toHaveBeenCalledTimes(1)
    expect(setTag).toHaveBeenCalledWith('requestId', 'req-123')
    expect(setContext).toHaveBeenCalledWith('request', {
      requestId: 'req-123',
      path: '/api/test',
      method: 'GET'
    })
    expect(setUser).toHaveBeenCalledWith({ id: 'user-1' })
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
  })

  it('does not capture 4xx errors', async () => {
    const { captureSentryError } = await import('../../config/sentry.config')

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
    const { captureSentryError } = await import('../../config/sentry.config')

    expect(() =>
      captureSentryError(new Error('server error'), createRequest(), 500)
    ).not.toThrow()
  })
})

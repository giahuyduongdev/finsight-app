import type { NextFunction, Request, Response } from 'express'

const createResponse = () => {
  const response = {
    status: jest.fn(),
    type: jest.fn(),
    send: jest.fn()
  }
  response.status.mockReturnValue(response)
  response.type.mockReturnValue(response)
  response.send.mockReturnValue(response)
  return response as unknown as Response & {
    status: jest.Mock
    type: jest.Mock
    send: jest.Mock
  }
}

describe('observability metrics endpoint', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('returns Prometheus metrics with the project prefix when enabled', async () => {
    process.env.METRICS_ENABLED = 'true'

    const { metricsHandler, metricsRegistry } =
      await import('../../observability')
    const response = createResponse()

    await metricsHandler({} as Request, response, jest.fn() as NextFunction)

    expect(response.type).toHaveBeenCalledWith(metricsRegistry.contentType)
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining('finsight_process_')
    )
  })

  it('returns 404 when metrics are disabled', async () => {
    process.env.METRICS_ENABLED = 'false'

    const { metricsHandler } = await import('../../observability')
    const response = createResponse()

    await metricsHandler({} as Request, response, jest.fn() as NextFunction)

    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.send).toHaveBeenCalledWith('Not found')
  })
})

import { EventEmitter } from 'events'

class FakeMongoClient extends EventEmitter {
  on(eventName: string, listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener)
  }
}

const emitPoolEvent = (
  client: FakeMongoClient,
  eventName: string,
  connectionId?: number,
  reason?: string
) => {
  client.emit(eventName, {
    address: 'localhost:27017',
    connectionId,
    reason
  })
}

describe('mongodb pool metrics', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('records MongoDB connection pool state from driver events', async () => {
    const { instrumentMongoDBPoolMetrics, metricsRegistry } =
      await import('../../../observability')
    const client = new FakeMongoClient()

    instrumentMongoDBPoolMetrics({ getClient: () => client })

    emitPoolEvent(client, 'connectionCreated', 1)
    emitPoolEvent(client, 'connectionReady', 1)
    emitPoolEvent(client, 'connectionCheckedOut', 1)

    let metrics = await metricsRegistry.metrics()
    expect(metrics).toContain('finsight_mongodb_pool_connections')
    expect(metrics).toContain('address="localhost:27017",state="total"} 1')
    expect(metrics).toContain('address="localhost:27017",state="ready"} 1')
    expect(metrics).toContain(
      'address="localhost:27017",state="checked_out"} 1'
    )

    emitPoolEvent(client, 'connectionCheckedIn', 1)
    emitPoolEvent(client, 'connectionClosed', 1, 'stale')

    metrics = await metricsRegistry.metrics()
    expect(metrics).toContain('address="localhost:27017",state="total"} 0')
    expect(metrics).toContain('address="localhost:27017",state="ready"} 0')
    expect(metrics).toContain(
      'address="localhost:27017",state="checked_out"} 0'
    )
    expect(metrics).toContain(
      'address="localhost:27017",event="connectionClosed",reason="stale"} 1'
    )
  })

  it('records checkout failures with bounded reasons', async () => {
    const { instrumentMongoDBPoolMetrics, metricsRegistry } =
      await import('../../../observability')
    const client = new FakeMongoClient()

    instrumentMongoDBPoolMetrics({ getClient: () => client })

    emitPoolEvent(client, 'connectionCheckOutFailed', undefined, 'Timeout!')

    const metrics = await metricsRegistry.metrics()
    expect(metrics).toContain('finsight_mongodb_pool_checkout_failures_total')
    expect(metrics).toContain('reason="timeout_"} 1')
    expect(metrics).not.toContain('Timeout!')
  })

  it('does not attach duplicate listeners for the same client', async () => {
    const { instrumentMongoDBPoolMetrics } =
      await import('../../../observability')
    const client = new FakeMongoClient()
    const connection = { getClient: () => client }

    instrumentMongoDBPoolMetrics(connection)
    instrumentMongoDBPoolMetrics(connection)

    expect(client.listenerCount('connectionCreated')).toBe(1)
  })
})

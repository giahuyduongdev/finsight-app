import { Counter, Gauge } from 'prom-client'
import { metricsRegistry } from './metrics.registry'

type MongoPoolEvent = {
  address?: string
  connectionId?: number | string
  reason?: string
}

type MongoPoolClient = {
  on: (eventName: string, listener: (...args: unknown[]) => void) => unknown
}

type MongoConnection = {
  getClient?: () => MongoPoolClient
}

type ConnectionState = {
  ready: boolean
  checkedOut: boolean
}

type PoolState = {
  total: number
  ready: number
  checkedOut: number
  connections: Map<string, ConnectionState>
}

const mongoPoolConnections = new Gauge({
  name: 'finsight_mongodb_pool_connections',
  help: 'MongoDB driver connection pool connections by state',
  labelNames: ['address', 'state'] as const,
  registers: [metricsRegistry]
})

const mongoPoolEvents = new Counter({
  name: 'finsight_mongodb_pool_events_total',
  help: 'MongoDB driver connection pool events',
  labelNames: ['address', 'event', 'reason'] as const,
  registers: [metricsRegistry]
})

const mongoPoolCheckoutFailures = new Counter({
  name: 'finsight_mongodb_pool_checkout_failures_total',
  help: 'MongoDB driver connection checkout failures',
  labelNames: ['address', 'reason'] as const,
  registers: [metricsRegistry]
})

const attachedClients = new WeakSet<object>()
const poolStates = new WeakMap<object, Map<string, PoolState>>()

const normalizeAddress = (address?: string) => address || 'unknown'

const normalizeReason = (reason?: string) =>
  (reason || 'none')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 64)

const getConnectionKey = (event: MongoPoolEvent) =>
  `${normalizeAddress(event.address)}:${String(event.connectionId ?? 'unknown')}`

const getPoolState = (client: object, address: string) => {
  let clientPools = poolStates.get(client)
  if (!clientPools) {
    clientPools = new Map<string, PoolState>()
    poolStates.set(client, clientPools)
  }

  let poolState = clientPools.get(address)
  if (!poolState) {
    poolState = {
      total: 0,
      ready: 0,
      checkedOut: 0,
      connections: new Map<string, ConnectionState>()
    }
    clientPools.set(address, poolState)
  }

  return poolState
}

const setPoolGauges = (address: string, poolState: PoolState) => {
  mongoPoolConnections.set({ address, state: 'total' }, poolState.total)
  mongoPoolConnections.set({ address, state: 'ready' }, poolState.ready)
  mongoPoolConnections.set(
    { address, state: 'checked_out' },
    poolState.checkedOut
  )
}

const recordPoolEvent = (
  client: object,
  eventName: string,
  event: MongoPoolEvent
) => {
  const address = normalizeAddress(event.address)
  mongoPoolEvents.inc({
    address,
    event: eventName,
    reason: normalizeReason(event.reason)
  })

  const poolState = getPoolState(client, address)
  const connectionKey = getConnectionKey(event)

  if (eventName === 'connectionCreated') {
    if (!poolState.connections.has(connectionKey)) {
      poolState.connections.set(connectionKey, {
        ready: false,
        checkedOut: false
      })
      poolState.total += 1
    }
  }

  if (eventName === 'connectionReady') {
    const connection =
      poolState.connections.get(connectionKey) ??
      ({ ready: false, checkedOut: false } satisfies ConnectionState)

    if (!poolState.connections.has(connectionKey)) {
      poolState.connections.set(connectionKey, connection)
      poolState.total += 1
    }

    if (!connection.ready) {
      connection.ready = true
      poolState.ready += 1
    }
  }

  if (eventName === 'connectionCheckedOut') {
    const connection =
      poolState.connections.get(connectionKey) ??
      ({ ready: true, checkedOut: false } satisfies ConnectionState)

    if (!poolState.connections.has(connectionKey)) {
      poolState.connections.set(connectionKey, connection)
      poolState.total += 1
      poolState.ready += 1
    }

    if (!connection.checkedOut) {
      connection.checkedOut = true
      poolState.checkedOut += 1
    }
  }

  if (eventName === 'connectionCheckedIn') {
    const connection = poolState.connections.get(connectionKey)
    if (connection?.checkedOut) {
      connection.checkedOut = false
      poolState.checkedOut = Math.max(poolState.checkedOut - 1, 0)
    }
  }

  if (eventName === 'connectionClosed') {
    const connection = poolState.connections.get(connectionKey)
    if (connection) {
      poolState.total = Math.max(poolState.total - 1, 0)
      if (connection.ready) poolState.ready = Math.max(poolState.ready - 1, 0)
      if (connection.checkedOut) {
        poolState.checkedOut = Math.max(poolState.checkedOut - 1, 0)
      }
      poolState.connections.delete(connectionKey)
    }
  }

  if (eventName === 'connectionPoolClosed') {
    poolState.total = 0
    poolState.ready = 0
    poolState.checkedOut = 0
    poolState.connections.clear()
  }

  if (eventName === 'connectionCheckOutFailed') {
    mongoPoolCheckoutFailures.inc({
      address,
      reason: normalizeReason(event.reason)
    })
  }

  setPoolGauges(address, poolState)
}

export const instrumentMongoDBPoolMetrics = (connection: MongoConnection) => {
  const client = connection.getClient?.()
  if (!client || attachedClients.has(client)) return

  attachedClients.add(client)

  const poolEvents = [
    'connectionPoolCreated',
    'connectionPoolReady',
    'connectionPoolCleared',
    'connectionPoolClosed',
    'connectionCreated',
    'connectionReady',
    'connectionClosed',
    'connectionCheckOutStarted',
    'connectionCheckedOut',
    'connectionCheckedIn',
    'connectionCheckOutFailed'
  ] as const

  for (const eventName of poolEvents) {
    client.on(eventName, (event) =>
      recordPoolEvent(client, eventName, event as MongoPoolEvent)
    )
  }
}

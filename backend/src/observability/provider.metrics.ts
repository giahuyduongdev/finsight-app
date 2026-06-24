import { Counter, Histogram } from 'prom-client'
import { metricsRegistry } from './metrics.registry'

export type ProviderName = 'gemini' | 'cloudinary' | 'resend' | 'other'

export type ProviderOperation = {
  provider: ProviderName
  operation: string
}

const providerRequests = new Counter({
  name: 'finsight_provider_requests_total',
  help: 'Total external provider requests',
  labelNames: ['provider', 'operation', 'outcome', 'error_class'] as const,
  registers: [metricsRegistry]
})

const providerDuration = new Histogram({
  name: 'finsight_provider_request_duration_seconds',
  help: 'External provider request duration in seconds',
  labelNames: ['provider', 'operation', 'outcome'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [metricsRegistry]
})

const circuitBreakerTransitions = new Counter({
  name: 'finsight_circuit_breaker_transitions_total',
  help: 'Circuit breaker state transitions',
  labelNames: ['service', 'from_state', 'to_state'] as const,
  registers: [metricsRegistry]
})

export const classifyProviderError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error)

  if (message.includes('429') || message.includes('resource_exhausted')) {
    return 'rate_limit'
  }
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('deadline_exceeded') ||
    message.includes('abort')
  ) {
    return 'timeout'
  }
  if (
    message.includes('503') ||
    message.includes('504') ||
    message.includes('unavailable') ||
    message.includes('network')
  ) {
    return 'unavailable'
  }
  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('api_key_invalid') ||
    message.includes('permission_denied')
  ) {
    return 'authentication'
  }
  if (
    message.includes('invalid_argument') ||
    message.includes('validation') ||
    message.includes('nonreceipt')
  ) {
    return 'validation'
  }
  return 'unknown'
}

export const observeProviderCall = async <T>(
  operation: ProviderOperation,
  call: () => Promise<T>
): Promise<T> => {
  const startedAt = process.hrtime.bigint()

  try {
    const result = await call()
    providerRequests.inc({
      ...operation,
      outcome: 'success',
      error_class: 'none'
    })
    providerDuration.observe(
      { ...operation, outcome: 'success' },
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
    )
    return result
  } catch (error) {
    providerRequests.inc({
      ...operation,
      outcome: 'error',
      error_class: classifyProviderError(error)
    })
    providerDuration.observe(
      { ...operation, outcome: 'error' },
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
    )
    throw error
  }
}

export const recordCircuitBreakerTransition = (
  service: string,
  fromState: string,
  toState: string
) => {
  circuitBreakerTransitions.inc({
    service: service.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    from_state: fromState.toLowerCase(),
    to_state: toState.toLowerCase()
  })
}

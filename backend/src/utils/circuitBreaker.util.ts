import { HTTPSTATUS } from '../config/http.config'
import { logger } from '../config/logger.config'
import { ErrorCodeEnum } from '../enums/error-code.enum'
import { AppError } from './errors/index'

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold?: number
  resetTimeoutMs?: number
}

const DEFAULT_FAILURE_THRESHOLD = 5
const DEFAULT_RESET_TIMEOUT_MS = 30000

export class CircuitBreaker {
  private state = CircuitState.CLOSED
  private failureCount = 0
  private lastFailureTime: number | null = null
  private probeInProgress = false
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD
    this.resetTimeoutMs = config.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS
  }

  getState(): CircuitState {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }

  reset(): void {
    this.transitionTo(CircuitState.CLOSED, 'manual reset')
    this.failureCount = 0
    this.lastFailureTime = null
  }

  async execute<T>(
    operation: () => Promise<T>,
    serviceName: string
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN, serviceName)
      } else {
        throw new AppError(
          `${serviceName} circuit breaker is open`,
          HTTPSTATUS.SERVICE_UNAVAILABLE,
          ErrorCodeEnum.CIRCUIT_BREAKER_OPEN,
          { serviceName, state: this.state }
        )
      }
    }

    const isHalfOpenProbe = this.state === CircuitState.HALF_OPEN
    if (isHalfOpenProbe) {
      if (this.probeInProgress) {
        throw new AppError(
          `${serviceName} circuit breaker is half-open`,
          HTTPSTATUS.SERVICE_UNAVAILABLE,
          ErrorCodeEnum.CIRCUIT_BREAKER_OPEN,
          { serviceName, state: this.state }
        )
      }
      this.probeInProgress = true
    }

    try {
      const result = await operation()
      this.recordSuccess(serviceName)
      return result
    } catch (error) {
      this.recordFailure(serviceName, error)
      throw error
    } finally {
      if (isHalfOpenProbe) {
        this.probeInProgress = false
      }
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime >= this.resetTimeoutMs
    )
  }

  private recordSuccess(serviceName: string): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.CLOSED, serviceName)
    }

    this.failureCount = 0
    this.lastFailureTime = null
  }

  private recordFailure(serviceName: string, error: unknown): void {
    this.failureCount += 1
    this.lastFailureTime = Date.now()

    logger.warn(`[APP:CircuitBreaker] ${serviceName} operation failed`, {
      serviceName,
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error instanceof Error ? error.message : String(error)
    })

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN, serviceName)
    }
  }

  private transitionTo(nextState: CircuitState, reason: string): void {
    if (this.state === nextState) return

    const previousState = this.state
    this.state = nextState

    logger.warn('[APP:CircuitBreaker] State transition', {
      previousState,
      nextState,
      reason,
      failureCount: this.failureCount
    })
  }
}

export const geminiCircuitBreaker = new CircuitBreaker()
export const resendCircuitBreaker = new CircuitBreaker()
export const cloudinaryCircuitBreaker = new CircuitBreaker()

import { AsyncLocalStorage } from 'async_hooks'

/**
 * Request context interface for AsyncLocalStorage
 */
export interface RequestContext {
  correlationId?: string
  userId?: string
  method?: string
  path?: string
  startTime?: number
}

/**
 * AsyncLocalStorage instance for storing request context
 * This allows automatic context propagation without explicitly passing req object
 */
export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>()

/**
 * Get the current request context from AsyncLocalStorage
 * @returns RequestContext object or empty object if no context available
 */
export const getRequestContext = (): RequestContext => {
  return asyncLocalStorage.getStore() || {}
}

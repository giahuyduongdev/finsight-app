/**
 * AnalyticsService Unit Tests
 */

import { AnalyticsService } from '../../services/analytics.service'
import { MockTransactionRepository } from '../mocks/transaction-repository.mock'

describe('AnalyticsService', () => {
  let service: AnalyticsService
  let mockTransactionRepo: MockTransactionRepository

  beforeEach(() => {
    mockTransactionRepo = new MockTransactionRepository()
    service = new AnalyticsService(mockTransactionRepo)
  })

  afterEach(() => {
    mockTransactionRepo.clear()
  })

  describe('Service Initialization', () => {
    it('should create AnalyticsService instance successfully', () => {
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(AnalyticsService)
    })

    it('should have getAnalytics method', () => {
      expect(service.getAnalytics).toBeDefined()
      expect(typeof service.getAnalytics).toBe('function')
    })

    it('should have getChartAnalytics method', () => {
      expect(service.getChartAnalytics).toBeDefined()
      expect(typeof service.getChartAnalytics).toBe('function')
    })

    it('should have getCategoryBreakdown method', () => {
      expect(service.getCategoryBreakdown).toBeDefined()
      expect(typeof service.getCategoryBreakdown).toBe('function')
    })
  })

  // Note: Full integration tests for analytics methods require:
  // - Real MongoDB connection for aggregation pipelines
  // - Redis connection for caching
  // - Exchange rate API for currency conversion
  // These are better suited for integration tests rather than unit tests
})

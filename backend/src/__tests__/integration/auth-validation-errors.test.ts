import request from 'supertest'

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  })),
  FlowProducer: jest.fn().mockImplementation(() => ({
    close: jest.fn()
  }))
}))

jest.mock('../../config/bull/bullmq.config', () => ({
  bullMQConnection: {
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('../../queues', () => ({
  transactionQueue: { add: jest.fn(), close: jest.fn() },
  receiptQueue: { add: jest.fn(), close: jest.fn() },
  reportQueue: { add: jest.fn(), close: jest.fn() },
  transactionFlowProducer: { close: jest.fn() },
  closeQueues: jest.fn().mockResolvedValue(undefined)
}))

import app from '../../app'
import { HTTPSTATUS } from '../../config/http.config'
import { ErrorCodeEnum } from '../../enums/error-code.enum'
import { closeQueues } from '../../queues'

/**
 * Integration test to verify error handling consistency
 * with actual auth routes after refactoring to validation middleware
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.4
 */

interface ValidationError {
  field: string
  message: string
}

describe('Auth Routes - Validation Error Handling', () => {
  // Clean up connections after all tests
  afterAll(async () => {
    await closeQueues()
  })
  describe('POST /api/v1/auth/login', () => {
    it('should return 400 with proper error format for invalid email', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'invalid-email',
        password: 'password123'
      })

      expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
      expect(response.body.error).toMatchObject({
        message: 'Validation failed',
        code: ErrorCodeEnum.VALIDATION_ERROR
      })
      expect(response.body.error.details).toBeDefined()
      expect(Array.isArray(response.body.error.details)).toBe(true)

      const emailError = response.body.error.details.find(
        (e: ValidationError) => e.field === 'email'
      )
      expect(emailError).toBeDefined()
      expect(emailError.message).toBeDefined()
    })

    it('should return 400 with field-level errors for multiple validation failures', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'not-an-email',
        password: '123'
      })

      expect(response.status).toBe(400)
      expect(response.body.error.details).toBeDefined()
      expect(response.body.error.details.length).toBeGreaterThan(0)

      // Should have errors for both email and password
      const fields = response.body.error.details.map(
        (e: ValidationError) => e.field
      )
      expect(fields).toContain('email')
      expect(fields).toContain('password')
    })

    it('should return 400 for missing required fields', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({})

      expect(response.status).toBe(400)
      expect(response.body.error.message).toBe('Validation failed')
      expect(response.body.error.details).toBeDefined()

      const fields = response.body.error.details.map(
        (e: ValidationError) => e.field
      )
      expect(fields).toContain('email')
      expect(fields).toContain('password')
    })
  })

  describe('POST /api/v1/auth/register', () => {
    it('should return 400 with proper error format for invalid data', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'invalid',
        password: '123',
        name: 'ab'
      })

      expect(response.status).toBe(400)
      expect(response.body.error).toMatchObject({
        message: 'Validation failed',
        code: ErrorCodeEnum.VALIDATION_ERROR
      })
      expect(response.body.error.details).toBeDefined()
      expect(response.body.error.details.length).toBeGreaterThan(0)
    })
  })

  describe('POST /api/v1/auth/password/forgot', () => {
    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({
          email: 'not-an-email'
        })

      expect(response.status).toBe(400)
      expect(response.body.error.message).toBe('Validation failed')
      expect(response.body.error.details).toBeDefined()

      const emailError = response.body.error.details.find(
        (e: ValidationError) => e.field === 'email'
      )
      expect(emailError).toBeDefined()
    })
  })

  describe('Error Response Structure', () => {
    it('should include all required metadata fields', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'invalid'
      })

      expect(response.status).toBe(400)

      // Verify all required fields are present in new standardized format
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('message')
      expect(response.body.error).toHaveProperty('details')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('requestId')
      expect(response.body.error).toHaveProperty('timestamp')
      expect(response.body.error).toHaveProperty('path')
      expect(response.body.error).toHaveProperty('method')
      expect(response.body.error).toHaveProperty('userMessage')

      // Verify field types
      expect(typeof response.body.error.message).toBe('string')
      expect(Array.isArray(response.body.error.details)).toBe(true)
      expect(typeof response.body.error.code).toBe('string')
      expect(typeof response.body.error.requestId).toBe('string')
      expect(typeof response.body.error.timestamp).toBe('string')
      expect(typeof response.body.error.path).toBe('string')
      expect(typeof response.body.error.method).toBe('string')
      expect(typeof response.body.error.userMessage).toBe('string')
    })

    it('should have valid ISO timestamp', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid' })

      expect(response.status).toBe(400)
      expect(response.body.error.timestamp).toBeDefined()

      // Verify it's a valid ISO date string
      const date = new Date(response.body.error.timestamp)
      expect(date.toISOString()).toBe(response.body.error.timestamp)
    })
  })
})

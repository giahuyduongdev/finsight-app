import request from 'supertest'
import app from '../../app'
import { HTTPSTATUS } from '../../config/http.config'
import { ErrorCodeEnum } from '../../enums/error-code.enum'
import { disconnectDatabases } from '../../databases'
import { transactionQueue, receiptQueue } from '../../queues'

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
    // Close BullMQ queues
    await transactionQueue.close()
    await receiptQueue.close()

    // Disconnect databases
    await disconnectDatabases()

    // Give Jest a moment to clean up
    await new Promise((resolve) => setTimeout(resolve, 500))
  })
  describe('POST /api/auth/login', () => {
    it('should return 400 with proper error format for invalid email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'invalid-email',
        password: 'password123'
      })

      expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
      expect(response.body).toMatchObject({
        message: 'Validation failed',
        errorCode: ErrorCodeEnum.VALIDATION_ERROR
      })
      expect(response.body.errors).toBeDefined()
      expect(Array.isArray(response.body.errors)).toBe(true)

      const emailError = response.body.errors.find(
        (e: ValidationError) => e.field === 'email'
      )
      expect(emailError).toBeDefined()
      expect(emailError.message).toBeDefined()
    })

    it('should return 400 with field-level errors for multiple validation failures', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'not-an-email',
        password: '123'
      })

      expect(response.status).toBe(400)
      expect(response.body.errors).toBeDefined()
      expect(response.body.errors.length).toBeGreaterThan(0)

      // Should have errors for both email and password
      const fields = response.body.errors.map((e: ValidationError) => e.field)
      expect(fields).toContain('email')
      expect(fields).toContain('password')
    })

    it('should return 400 for missing required fields', async () => {
      const response = await request(app).post('/api/auth/login').send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Validation failed')
      expect(response.body.errors).toBeDefined()

      const fields = response.body.errors.map((e: ValidationError) => e.field)
      expect(fields).toContain('email')
      expect(fields).toContain('password')
    })
  })

  describe('POST /api/auth/register', () => {
    it('should return 400 with proper error format for invalid data', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'invalid',
        password: '123',
        name: 'ab'
      })

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        message: 'Validation failed',
        errorCode: ErrorCodeEnum.VALIDATION_ERROR
      })
      expect(response.body.errors).toBeDefined()
      expect(response.body.errors.length).toBeGreaterThan(0)
    })
  })

  describe('POST /api/auth/password/forgot', () => {
    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/password/forgot')
        .send({
          email: 'not-an-email'
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Validation failed')
      expect(response.body.errors).toBeDefined()

      const emailError = response.body.errors.find(
        (e: ValidationError) => e.field === 'email'
      )
      expect(emailError).toBeDefined()
    })
  })

  describe('Error Response Structure', () => {
    it('should include all required metadata fields', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'invalid'
      })

      expect(response.status).toBe(400)

      // Verify all required fields are present
      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('errors')
      expect(response.body).toHaveProperty('errorCode')
      expect(response.body).toHaveProperty('requestId')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('path')
      expect(response.body).toHaveProperty('method')
      expect(response.body).toHaveProperty('userMessage')

      // Verify field types
      expect(typeof response.body.message).toBe('string')
      expect(Array.isArray(response.body.errors)).toBe(true)
      expect(typeof response.body.errorCode).toBe('string')
      expect(typeof response.body.requestId).toBe('string')
      expect(typeof response.body.timestamp).toBe('string')
      expect(typeof response.body.path).toBe('string')
      expect(typeof response.body.method).toBe('string')
      expect(typeof response.body.userMessage).toBe('string')
    })

    it('should have valid ISO timestamp', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid' })

      expect(response.status).toBe(400)
      expect(response.body.timestamp).toBeDefined()

      // Verify it's a valid ISO date string
      const date = new Date(response.body.timestamp)
      expect(date.toISOString()).toBe(response.body.timestamp)
    })
  })
})

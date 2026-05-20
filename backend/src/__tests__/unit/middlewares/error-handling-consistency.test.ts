import request from 'supertest'
import express, { Express } from 'express'
import { z } from 'zod'
import { validate } from '../../../middlewares/validate.middleware'
import { errorHandler } from '../../../middlewares/errorHandler.middleware'
import { asyncHandler } from '../../../middlewares/asyncHandler.middleware'
import { HTTPSTATUS } from '../../../config/http.config'
import { ErrorCodeEnum } from '../../../enums/error-code.enum'

/**
 * Error Handling Consistency Tests
 *
 * This test suite verifies that validation errors are handled consistently
 * after the refactoring to use validation middleware. It ensures:
 *
 * 1. All validation errors return HTTP 400
 * 2. Error response format matches existing implementation
 * 3. ZodError is properly handled by error middleware
 * 4. Field-level error messages are preserved
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.4
 */

interface ValidationError {
  field: string
  message: string
}

describe('Error Handling Consistency', () => {
  let app: Express

  beforeEach(() => {
    app = express()
    app.use(express.json())

    // Add correlation ID middleware (simplified for testing)
    app.use((req, _res, next) => {
      req.correlationId = 'test-correlation-id'
      next()
    })
  })

  describe('HTTP 400 Status Code', () => {
    it('should return 400 for body validation errors', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6)
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).post('/test').send({
        email: 'invalid-email',
        password: '123'
      })

      expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
      expect(response.status).toBe(400)
    })

    it('should return 400 for params validation errors', async () => {
      const schema = z.string().uuid()

      app.get(
        '/test/:id',
        validate(schema, 'params'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).get('/test/invalid-uuid')

      expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
      expect(response.status).toBe(400)
    })

    it('should return 400 for query validation errors', async () => {
      const schema = z.object({
        page: z.string().regex(/^\d+$/),
        limit: z.string().regex(/^\d+$/)
      })

      app.get(
        '/test',
        validate(schema, 'query'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).get('/test?page=invalid&limit=abc')

      expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
      expect(response.status).toBe(400)
    })
  })

  describe('Error Response Format', () => {
    it('should match existing error response structure', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6)
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).post('/test').send({
        email: 'invalid-email',
        password: '123'
      })

      // Verify response structure matches new standardized ErrorResponse format
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
      expect(response.body.error).toHaveProperty('userMessage')
      expect(response.body.error).toHaveProperty('statusCode')
      expect(response.body.error).toHaveProperty('requestId')
      expect(response.body.error).toHaveProperty('timestamp')
      expect(response.body.error).toHaveProperty('path')
      expect(response.body.error).toHaveProperty('method')
      expect(response.body.error).toHaveProperty('details')

      // Verify specific values
      expect(response.body.error.message).toBe('Validation failed')
      expect(response.body.error.code).toBe(ErrorCodeEnum.VALIDATION_ERROR)
      expect(response.body.error.requestId).toBe('test-correlation-id')
      expect(response.body.error.path).toBe('/test')
      expect(response.body.error.method).toBe('POST')
    })

    it('should include timestamp in ISO format', async () => {
      const schema = z.object({
        email: z.string().email()
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app)
        .post('/test')
        .send({ email: 'invalid' })

      expect(response.body.error.timestamp).toBeDefined()
      expect(() => new Date(response.body.error.timestamp)).not.toThrow()
      expect(new Date(response.body.error.timestamp).toISOString()).toBe(
        response.body.error.timestamp
      )
    })

    it('should include userMessage field', async () => {
      const schema = z.object({
        email: z.string().email()
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app)
        .post('/test')
        .send({ email: 'invalid' })

      expect(response.body.error.userMessage).toBeDefined()
      expect(typeof response.body.error.userMessage).toBe('string')
    })
  })

  describe('ZodError Handling', () => {
    it('should properly handle ZodError from validation middleware', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6)
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).post('/test').send({
        email: 'invalid-email',
        password: '123'
      })

      // Verify ZodError was properly formatted
      expect(response.body.error.message).toBe('Validation failed')
      expect(response.body.error.code).toBe(ErrorCodeEnum.VALIDATION_ERROR)
      expect(Array.isArray(response.body.error.details)).toBe(true)
    })

    it('should handle ZodError with async refinements', async () => {
      const schema = z
        .object({
          password: z.string().min(6),
          confirmPassword: z.string()
        })
        .refine(async (data) => data.password === data.confirmPassword, {
          message: 'Passwords do not match',
          path: ['confirmPassword']
        })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).post('/test').send({
        password: 'password123',
        confirmPassword: 'different'
      })

      expect(response.status).toBe(400)
      expect(response.body.error.message).toBe('Validation failed')
      expect(response.body.error.details).toBeDefined()
    })
  })

  describe('Field-Level Error Messages', () => {
    it('should preserve field names in error messages', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        username: z.string().min(3)
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).post('/test').send({
        email: 'invalid-email',
        password: '123',
        username: 'ab'
      })

      expect(response.body.error.details).toBeDefined()
      expect(Array.isArray(response.body.error.details)).toBe(true)
      expect(response.body.error.details.length).toBeGreaterThan(0)

      // Verify each error has field and message
      response.body.error.details.forEach((error: ValidationError) => {
        expect(error).toHaveProperty('field')
        expect(error).toHaveProperty('message')
        expect(typeof error.field).toBe('string')
        expect(typeof error.message).toBe('string')
      })
    })

    it('should preserve specific error messages for each field', async () => {
      const schema = z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        age: z.number().min(18, 'Must be at least 18 years old')
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).post('/test').send({
        email: 'not-an-email',
        password: '123',
        age: 15
      })

      expect(response.body.error.details).toBeDefined()
      expect(response.body.error.details.length).toBe(3)

      // Find specific field errors
      const emailError = response.body.error.details.find(
        (e: ValidationError) => e.field === 'email'
      )
      const passwordError = response.body.error.details.find(
        (e: ValidationError) => e.field === 'password'
      )
      const ageError = response.body.error.details.find(
        (e: ValidationError) => e.field === 'age'
      )

      expect(emailError).toBeDefined()
      expect(emailError.message).toBe('Invalid email address')

      expect(passwordError).toBeDefined()
      expect(passwordError.message).toBe(
        'Password must be at least 6 characters'
      )

      expect(ageError).toBeDefined()
      expect(ageError.message).toBe('Must be at least 18 years old')
    })

    it('should handle nested field paths correctly', async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email()
          })
        })
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app)
        .post('/test')
        .send({
          user: {
            profile: {
              email: 'invalid'
            }
          }
        })

      expect(response.body.error.details).toBeDefined()
      expect(response.body.error.details.length).toBeGreaterThan(0)

      const emailError = response.body.error.details.find(
        (e: ValidationError) => e.field === 'user.profile.email'
      )
      expect(emailError).toBeDefined()
    })

    it('should handle multiple validation errors for the same field', async () => {
      const schema = z.object({
        password: z
          .string()
          .min(6, 'Too short')
          .max(20, 'Too long')
          .regex(/[A-Z]/, 'Must contain uppercase')
          .regex(/[0-9]/, 'Must contain number')
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).post('/test').send({
        password: 'abc'
      })

      expect(response.body.error.details).toBeDefined()
      expect(response.body.error.details.length).toBeGreaterThan(0)

      // Should have at least one error for password field
      const passwordErrors = response.body.error.details.filter(
        (e: ValidationError) => e.field === 'password'
      )
      expect(passwordErrors.length).toBeGreaterThan(0)
    })
  })

  describe('Missing Required Fields', () => {
    it('should return errors for all missing required fields', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        username: z.string().min(3)
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app).post('/test').send({})

      expect(response.status).toBe(400)
      expect(response.body.error.details).toBeDefined()
      expect(response.body.error.details.length).toBe(3)

      const fields = response.body.error.details.map(
        (e: ValidationError) => e.field
      )
      expect(fields).toContain('email')
      expect(fields).toContain('password')
      expect(fields).toContain('username')
    })
  })

  describe('Backward Compatibility', () => {
    it('should use new standardized ErrorResponse format', async () => {
      const schema = z.object({
        email: z.string().email()
      })

      app.post(
        '/test',
        validate(schema, 'body'),
        asyncHandler(async (req, res) => {
          res.status(200).json({ success: true })
        })
      )
      app.use(errorHandler)

      const response = await request(app)
        .post('/test')
        .send({ email: 'invalid' })

      // Verify new standardized format with error wrapper
      expect(response.body).toHaveProperty('error')
      expect(Object.keys(response.body)).toEqual(['error'])

      // Verify error object structure
      const expectedErrorKeys = [
        'code',
        'message',
        'userMessage',
        'statusCode',
        'requestId',
        'timestamp',
        'path',
        'method',
        'details'
      ]

      const actualErrorKeys = Object.keys(response.body.error).sort()
      expect(actualErrorKeys).toEqual(expectedErrorKeys.sort())

      // Verify details array structure
      expect(Array.isArray(response.body.error.details)).toBe(true)
      response.body.error.details.forEach((error: ValidationError) => {
        expect(Object.keys(error).sort()).toEqual(['field', 'message'].sort())
      })
    })
  })
})

import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validate } from '../../../middlewares/validate.middleware'

describe('validate middleware', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {}
    }
    mockResponse = {}
    mockNext = jest.fn()
  })

  describe('body validation', () => {
    it('should validate valid body data and call next()', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6)
      })

      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123'
      }

      const middleware = validate(schema, 'body')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockRequest.body).toEqual({
        email: 'test@example.com',
        password: 'password123'
      })
    })

    it('should pass ZodError to next() on validation failure', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6)
      })

      mockRequest.body = {
        email: 'invalid-email',
        password: '123'
      }

      const middleware = validate(schema, 'body')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
      const error = (mockNext as jest.Mock).mock.calls[0][0]
      expect(error.name).toBe('ZodError')
    })
  })

  describe('params validation', () => {
    it('should validate valid params data with primitive schema', async () => {
      const schema = z.string().uuid()

      mockRequest.params = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      }

      const middleware = validate(schema, 'params')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockRequest.params.id).toBe('123e4567-e89b-12d3-a456-426614174000')
    })

    it('should validate valid params data with object schema', async () => {
      const schema = z.object({
        id: z.string().uuid(),
        slug: z.string()
      })

      mockRequest.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-slug'
      }

      const middleware = validate(schema, 'params')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockRequest.params).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-slug'
      })
    })
  })

  describe('query validation', () => {
    it('should validate valid query data', async () => {
      const schema = z.object({
        page: z.string().transform((val) => parseInt(val, 10)),
        limit: z.string().transform((val) => parseInt(val, 10))
      })

      mockRequest.query = {
        page: '1',
        limit: '10'
      }

      const middleware = validate(schema, 'query')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockRequest.query).toEqual({
        page: 1,
        limit: 10
      })
    })
  })

  describe('async validation', () => {
    it('should support async refinements', async () => {
      const schema = z
        .object({
          email: z.string().email(),
          password: z.string().min(6),
          confirmPassword: z.string()
        })
        .refine(async (data) => data.password === data.confirmPassword, {
          message: 'Passwords do not match',
          path: ['confirmPassword']
        })

      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      }

      const middleware = validate(schema, 'body')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith()
    })

    it('should handle async refinement failures', async () => {
      const schema = z
        .object({
          email: z.string().email(),
          password: z.string().min(6),
          confirmPassword: z.string()
        })
        .refine(async (data) => data.password === data.confirmPassword, {
          message: 'Passwords do not match',
          path: ['confirmPassword']
        })

      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different'
      }

      const middleware = validate(schema, 'body')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
      const error = (mockNext as jest.Mock).mock.calls[0][0]
      expect(error.name).toBe('ZodError')
    })
  })

  describe('edge cases', () => {
    it('should handle empty request body when schema requires fields', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6)
      })

      mockRequest.body = {}

      const middleware = validate(schema, 'body')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
      const error = (mockNext as jest.Mock).mock.calls[0][0]
      expect(error.name).toBe('ZodError')
    })

    it('should handle type transformations', async () => {
      const schema = z.object({
        createdAt: z.string().transform((val) => new Date(val))
      })

      mockRequest.body = {
        createdAt: '2024-01-15T10:30:00.000Z'
      }

      const middleware = validate(schema, 'body')
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockRequest.body.createdAt).toBeInstanceOf(Date)
    })
  })
})

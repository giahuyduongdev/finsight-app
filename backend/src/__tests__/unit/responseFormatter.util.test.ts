import { Request } from 'express'
import { ResponseFormatter } from '../../utils/responseFormatter.util'

const createMockRequest = (path = '/api/v1/transactions'): Request =>
  ({
    protocol: 'https',
    path,
    get: jest.fn((header: string) =>
      header.toLowerCase() === 'host' ? 'api.example.com' : undefined
    )
  }) as unknown as Request

describe('ResponseFormatter', () => {
  describe('success', () => {
    it('should wrap data in data field', () => {
      const response = ResponseFormatter.success({ id: 'tx-1' })

      expect(response).toEqual({
        data: { id: 'tx-1' }
      })
    })

    it('should include meta when provided', () => {
      const response = ResponseFormatter.success(
        { id: 'tx-1' },
        { message: 'Transaction fetched successfully' }
      )

      expect(response).toEqual({
        data: { id: 'tx-1' },
        meta: { message: 'Transaction fetched successfully' }
      })
    })
  })

  describe('paginated', () => {
    it('should include pagination metadata and links', () => {
      const response = ResponseFormatter.paginated(
        [{ id: 'tx-1' }],
        {
          pageNumber: 2,
          pageSize: 10,
          totalCount: 25,
          totalPages: 999
        },
        createMockRequest()
      )

      expect(response).toEqual({
        data: [{ id: 'tx-1' }],
        meta: {
          pagination: {
            pageNumber: 2,
            pageSize: 10,
            totalCount: 25,
            totalPages: 3
          }
        },
        links: {
          self: 'https://api.example.com/api/v1/transactions?pageNumber=2&pageSize=10',
          next: 'https://api.example.com/api/v1/transactions?pageNumber=3&pageSize=10',
          prev: 'https://api.example.com/api/v1/transactions?pageNumber=1&pageSize=10',
          first:
            'https://api.example.com/api/v1/transactions?pageNumber=1&pageSize=10',
          last: 'https://api.example.com/api/v1/transactions?pageNumber=3&pageSize=10'
        }
      })
    })

    it('should omit previous link on first page', () => {
      const response = ResponseFormatter.paginated(
        [],
        {
          pageNumber: 1,
          pageSize: 20,
          totalCount: 40,
          totalPages: 2
        },
        createMockRequest('/api/v1/reports')
      )

      expect(response.links).not.toHaveProperty('prev')
      expect(response.links?.next).toBe(
        'https://api.example.com/api/v1/reports?pageNumber=2&pageSize=20'
      )
    })

    it('should omit next link on last page', () => {
      const response = ResponseFormatter.paginated(
        [],
        {
          pageNumber: 3,
          pageSize: 5,
          totalCount: 15,
          totalPages: 3
        },
        createMockRequest()
      )

      expect(response.links).not.toHaveProperty('next')
      expect(response.links?.prev).toBe(
        'https://api.example.com/api/v1/transactions?pageNumber=2&pageSize=5'
      )
    })

    it('should calculate totalPages from totalCount and pageSize', () => {
      const response = ResponseFormatter.paginated(
        [],
        {
          pageNumber: 1,
          pageSize: 10,
          totalCount: 21,
          totalPages: 1
        },
        createMockRequest()
      )

      expect(response.meta?.pagination?.totalPages).toBe(3)
      expect(response.links?.last).toBe(
        'https://api.example.com/api/v1/transactions?pageNumber=3&pageSize=10'
      )
    })

    it('should use at least page 1 for last link when totalPages is 0', () => {
      const response = ResponseFormatter.paginated(
        [],
        {
          pageNumber: 1,
          pageSize: 10,
          totalCount: 0,
          totalPages: 0
        },
        createMockRequest()
      )

      expect(response.links?.last).toBe(
        'https://api.example.com/api/v1/transactions?pageNumber=1&pageSize=10'
      )
    })
  })
})

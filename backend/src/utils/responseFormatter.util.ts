import { Request } from 'express'
import { PaginationLinks, PaginationMeta, SuccessResponse } from '../@types'

export class ResponseFormatter {
  static success<T>(
    data: T,
    meta?: SuccessResponse<T>['meta']
  ): SuccessResponse<T> {
    return {
      data,
      ...(meta && { meta })
    }
  }

  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    req: Request
  ): SuccessResponse<T[]> {
    const normalizedPagination = this.normalizePagination(pagination)

    return {
      data,
      meta: { pagination: normalizedPagination },
      links: this.generatePaginationLinks(normalizedPagination, req)
    }
  }

  private static normalizePagination(
    pagination: PaginationMeta
  ): PaginationMeta {
    const totalPages =
      pagination.pageSize > 0
        ? Math.ceil(pagination.totalCount / pagination.pageSize)
        : 0

    return {
      ...pagination,
      totalPages
    }
  }

  private static generatePaginationLinks(
    pagination: PaginationMeta,
    req: Request
  ): PaginationLinks {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`
    const { pageNumber, pageSize, totalPages } = pagination

    return {
      self: `${baseUrl}?pageNumber=${pageNumber}&pageSize=${pageSize}`,
      ...(pageNumber < totalPages && {
        next: `${baseUrl}?pageNumber=${pageNumber + 1}&pageSize=${pageSize}`
      }),
      ...(pageNumber > 1 && {
        prev: `${baseUrl}?pageNumber=${pageNumber - 1}&pageSize=${pageSize}`
      }),
      first: `${baseUrl}?pageNumber=1&pageSize=${pageSize}`,
      last: `${baseUrl}?pageNumber=${Math.max(totalPages, 1)}&pageSize=${pageSize}`
    }
  }
}

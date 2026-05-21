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
    const baseUrl = req.path
    const { pageNumber, pageSize, totalPages } = pagination
    const buildLink = (targetPage: number) => {
      const query = new URLSearchParams()

      for (const [key, value] of Object.entries(req.query)) {
        if (key === 'pageNumber' || key === 'pageSize') continue
        if (value === undefined) continue
        if (Array.isArray(value)) {
          value.forEach((item) => query.append(key, String(item)))
          continue
        }
        query.set(key, String(value))
      }

      query.set('pageNumber', String(targetPage))
      query.set('pageSize', String(pageSize))

      return `${baseUrl}?${query.toString()}`
    }

    return {
      self: buildLink(pageNumber),
      ...(pageNumber < totalPages && {
        next: buildLink(pageNumber + 1)
      }),
      ...(pageNumber > 1 && {
        prev: buildLink(pageNumber - 1)
      }),
      first: buildLink(1),
      last: buildLink(Math.max(totalPages, 1))
    }
  }
}

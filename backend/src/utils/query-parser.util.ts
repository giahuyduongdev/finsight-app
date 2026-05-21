/**
 * Query Parser Utilities
 * Helper functions to parse and validate query parameters
 */

import { PaginationQuery } from '../types/query-filters.type'

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_PAGE_NUMBER = 1
const MAX_PAGE_SIZE = 100
const MAX_KEYWORD_LENGTH = 100

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Parse pagination query parameters
 * @param query - Request query object
 * @param defaults - Default values for pageSize and pageNumber
 * @returns Parsed pagination object with numbers
 */
export const parsePaginationQuery = (
  query: PaginationQuery,
  defaults: { pageSize?: number; pageNumber?: number } = {}
): { pageSize: number; pageNumber: number } => {
  const defaultPageSize = clampNumber(
    defaults.pageSize || DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE
  )
  const defaultPageNumber = Math.max(
    DEFAULT_PAGE_NUMBER,
    defaults.pageNumber || DEFAULT_PAGE_NUMBER
  )

  const parsedPageSize = parseInt(String(query.pageSize), 10)
  const parsedPageNumber = parseInt(String(query.pageNumber), 10)

  return {
    pageSize: Number.isFinite(parsedPageSize)
      ? clampNumber(parsedPageSize, 1, MAX_PAGE_SIZE)
      : defaultPageSize,
    pageNumber: Number.isFinite(parsedPageNumber)
      ? Math.max(DEFAULT_PAGE_NUMBER, parsedPageNumber)
      : defaultPageNumber
  }
}

export const normalizeSearchKeyword = (
  keyword?: string
): string | undefined => {
  const trimmed = keyword?.trim()
  if (!trimmed) return undefined

  return trimmed
    .slice(0, MAX_KEYWORD_LENGTH)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse and validate date string
 * @param dateStr - Date string to parse
 * @returns Date object or undefined if invalid
 */
export const parseDateQuery = (dateStr: unknown): Date | undefined => {
  if (!dateStr || typeof dateStr !== 'string') return undefined

  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? undefined : date
}

/**
 * Query Parser Utilities
 * Helper functions to parse and validate query parameters
 */

import { PaginationQuery } from '../types/query-filters.type'

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
  const defaultPageSize = defaults.pageSize || 20
  const defaultPageNumber = defaults.pageNumber || 1

  return {
    pageSize: parseInt(String(query.pageSize)) || defaultPageSize,
    pageNumber: parseInt(String(query.pageNumber)) || defaultPageNumber
  }
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

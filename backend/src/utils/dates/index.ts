/**
 * Date utilities for the application
 *
 * This module provides utilities for:
 * - Date range calculations (last 30 days, this month, custom ranges, etc.)
 * - Report scheduling (calculate next report dates)
 * - Recurring transactions (calculate next occurrence)
 *
 * @example
 * ```typescript
 * import { getDateRange, calculateNextReportDate } from '@/utils/dates'
 *
 * // Get last 30 days range
 * const range = getDateRange(DateRangeEnum.LAST_30_DAYS)
 *
 * // Calculate next monthly report
 * const nextReport = calculateNextReportDate(new Date(), 'MONTHLY')
 * ```
 */

// Export date range utilities
export * from './date-range'

// Export report date utilities
export * from './report-dates'

// Export recurring date utilities
export * from './recurring-dates'

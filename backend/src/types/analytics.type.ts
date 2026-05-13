/**
 * Analytics Type Definitions
 *
 * This module defines TypeScript interfaces and types for analytics, statistics,
 * and financial summaries. These types support dashboard analytics including
 * summary metrics, time-series charts, category breakdowns, and percentage
 * change calculations across different time periods.
 *
 * @module types/analytics
 */

import { DateRangePreset } from '../enums/date-range.enum'

/**
 * Date Range Filter for Analytics Queries
 *
 * Flexible date range specification for analytics queries. Supports both
 * preset ranges (e.g., "THIS_MONTH", "LAST_YEAR") and custom date ranges.
 * When using custom ranges, both customFrom and customTo must be provided.
 * The timezone parameter ensures date boundaries are calculated correctly
 * for the user's local time.
 *
 * @property dateRangePreset - Predefined date range option (e.g., THIS_MONTH, LAST_QUARTER)
 * @property customFrom - Start date for custom date range (required if using custom range)
 * @property customTo - End date for custom date range (required if using custom range)
 * @property timezone - IANA timezone identifier for date boundary calculations (e.g., "America/New_York")
 *
 * @example
 * Using preset range:
 * ```typescript
 * const filter: AnalyticsDateFilter = {
 *   dateRangePreset: DateRangePreset.THIS_MONTH,
 *   timezone: 'America/New_York'
 * };
 * ```
 *
 * @example
 * Using custom range:
 * ```typescript
 * const filter: AnalyticsDateFilter = {
 *   customFrom: new Date('2024-01-01'),
 *   customTo: new Date('2024-01-31'),
 *   timezone: 'UTC'
 * };
 * ```
 */
export interface AnalyticsDateFilter {
  dateRangePreset?: DateRangePreset
  customFrom?: Date
  customTo?: Date
  timezone?: string
}

/**
 * Percentage Change Comparison Between Periods
 *
 * Calculates percentage changes in financial metrics by comparing the current
 * period with the previous period of equal length. For example, if analyzing
 * "THIS_MONTH", the previous period would be "LAST_MONTH". Includes both the
 * percentage changes and the absolute values from the previous period for
 * context and verification.
 *
 * @property income - Percentage change in income (positive = increase, negative = decrease)
 * @property expenses - Percentage change in expenses (positive = increase, negative = decrease)
 * @property balance - Percentage change in balance (income - expenses)
 * @property prevPeriodFrom - Start date of the comparison period, or null if no previous period
 * @property prevPeriodTo - End date of the comparison period, or null if no previous period
 * @property previousValues - Absolute financial values from the previous period for reference
 * @property previousValues.incomeAmount - Total income in the previous period
 * @property previousValues.expenseAmount - Total expenses in the previous period
 * @property previousValues.balanceAmount - Net balance in the previous period
 *
 * @example
 * ```typescript
 * const change: PercentageChange = {
 *   income: 15.5,        // 15.5% increase
 *   expenses: -8.2,      // 8.2% decrease
 *   balance: 42.3,       // 42.3% increase
 *   prevPeriodFrom: new Date('2024-01-01'),
 *   prevPeriodTo: new Date('2024-01-31'),
 *   previousValues: {
 *     incomeAmount: 5000,
 *     expenseAmount: 3000,
 *     balanceAmount: 2000
 *   }
 * };
 * ```
 */
export interface PercentageChange {
  income: number
  expenses: number
  balance: number
  prevPeriodFrom: Date | null
  prevPeriodTo: Date | null
  previousValues: {
    incomeAmount: number
    expenseAmount: number
    balanceAmount: number
  }
}

/**
 * Savings Rate Metrics
 *
 * Calculates the user's savings rate as a percentage of income and the
 * corresponding expense ratio. The savings rate indicates what portion of
 * income is being saved (not spent), while the expense ratio shows what
 * portion is being spent. These two values always sum to 100%.
 *
 * Formula: savings rate = (income - expenses) / income * 100
 * Formula: expense ratio = expenses / income * 100
 *
 * @property percentage - Savings rate as a percentage of income (0-100)
 * @property expenseRatio - Expense ratio as a percentage of income (0-100)
 *
 * @example
 * ```typescript
 * const rate: SavingsRate = {
 *   percentage: 30,      // Saving 30% of income
 *   expenseRatio: 70     // Spending 70% of income
 * };
 * ```
 */
export interface SavingsRate {
  percentage: number
  expenseRatio: number
}

/**
 * Summary Analytics Response
 *
 * Comprehensive financial summary for a given time period. Provides high-level
 * metrics including balance, income, expenses, savings rate, transaction count,
 * and percentage changes compared to the previous period. This is the primary
 * analytics response for dashboard summary cards.
 *
 * @property availableBalance - Current available balance (income - expenses) in the user's preferred currency
 * @property totalIncome - Total income amount for the selected period
 * @property totalExpenses - Total expense amount for the selected period
 * @property savingRate - Savings rate metrics (percentage and expense ratio)
 * @property transactionCount - Total number of transactions in the selected period
 * @property percentageChange - Period-over-period comparison, or empty object if no previous period
 * @property currency - ISO 4217 currency code (e.g., "USD", "EUR")
 * @property preset - Date range information for the query
 * @property preset.from - Start date of the period, or null if unbounded
 * @property preset.to - End date of the period, or null if unbounded
 * @property preset.value - Preset identifier (e.g., "THIS_MONTH")
 * @property preset.label - Human-readable label (e.g., "This Month")
 *
 * @example
 * ```typescript
 * const summary: SummaryAnalytics = {
 *   availableBalance: 2500,
 *   totalIncome: 5000,
 *   totalExpenses: 2500,
 *   savingRate: {
 *     percentage: 50,
 *     expenseRatio: 50
 *   },
 *   transactionCount: 42,
 *   percentageChange: {
 *     income: 10,
 *     expenses: -5,
 *     balance: 25,
 *     prevPeriodFrom: new Date('2024-01-01'),
 *     prevPeriodTo: new Date('2024-01-31'),
 *     previousValues: {
 *       incomeAmount: 4545,
 *       expenseAmount: 2632,
 *       balanceAmount: 2000
 *     }
 *   },
 *   currency: 'USD',
 *   preset: {
 *     from: new Date('2024-02-01'),
 *     to: new Date('2024-02-29'),
 *     value: 'THIS_MONTH',
 *     label: 'This Month'
 *   }
 * };
 * ```
 */
export interface SummaryAnalytics {
  availableBalance: number
  totalIncome: number
  totalExpenses: number
  savingRate: SavingsRate
  transactionCount: number
  percentageChange: PercentageChange | Record<string, unknown>
  currency: string
  preset: {
    from?: Date | null
    to?: Date | null
    value: string
    label: string
  }
}

/**
 * Chart Data Point for Time Series
 *
 * Represents a single data point in time-series financial charts. Each point
 * contains income and expense values for a specific date, enabling visualization
 * of financial trends over time. The date format is ISO 8601 string for consistent
 * serialization and chart rendering.
 *
 * @property date - ISO 8601 date string (e.g., "2024-01-15")
 * @property income - Total income amount for this date
 * @property expenses - Total expense amount for this date
 *
 * @example
 * ```typescript
 * const dataPoint: ChartDataPoint = {
 *   date: '2024-01-15',
 *   income: 500,
 *   expenses: 300
 * };
 * ```
 */
export interface ChartDataPoint {
  date: string
  income: number
  expenses: number
}

/**
 * Chart Analytics Response
 *
 * Time-series data for rendering financial charts showing income and expense
 * trends over a selected period. Includes aggregated data points, transaction
 * counts, and metadata about the query period. Used for line charts, bar charts,
 * and other time-based visualizations.
 *
 * @property chartData - Array of data points ordered chronologically
 * @property totalIncomeCount - Total number of income transactions in the period
 * @property totalExpenseCount - Total number of expense transactions in the period
 * @property currency - ISO 4217 currency code for all amounts
 * @property preset - Date range information for the query
 * @property preset.from - Start date of the period, or null if unbounded
 * @property preset.to - End date of the period, or null if unbounded
 * @property preset.value - Preset identifier (e.g., "THIS_YEAR")
 * @property preset.label - Human-readable label (e.g., "This Year")
 *
 * @example
 * ```typescript
 * const chartData: ChartAnalytics = {
 *   chartData: [
 *     { date: '2024-01-01', income: 1000, expenses: 500 },
 *     { date: '2024-01-02', income: 1500, expenses: 800 },
 *     { date: '2024-01-03', income: 2000, expenses: 1200 }
 *   ],
 *   totalIncomeCount: 15,
 *   totalExpenseCount: 28,
 *   currency: 'USD',
 *   preset: {
 *     from: new Date('2024-01-01'),
 *     to: new Date('2024-01-31'),
 *     value: 'THIS_MONTH',
 *     label: 'This Month'
 *   }
 * };
 * ```
 */
export interface ChartAnalytics {
  chartData: ChartDataPoint[]
  totalIncomeCount: number
  totalExpenseCount: number
  currency: string
  preset: {
    from?: Date | null
    to?: Date | null
    value: string
    label: string
  }
}

/**
 * Category Breakdown Item for Pie Chart
 *
 * Represents a single category in expense breakdown visualizations. Contains
 * the category name, absolute spending amount, and percentage of total spending.
 * Used for pie charts, donut charts, and category ranking displays.
 *
 * @property name - Category name (e.g., "Food & Dining", "Transportation")
 * @property value - Total amount spent in this category
 * @property percentage - Percentage of total spending (0-100)
 *
 * @example
 * ```typescript
 * const item: CategoryBreakdownItem = {
 *   name: 'Food & Dining',
 *   value: 450,
 *   percentage: 30
 * };
 * ```
 */
export interface CategoryBreakdownItem {
  name: string
  value: number
  percentage: number
}

/**
 * Category Breakdown Analytics Response
 *
 * Expense breakdown by category for a given time period. Shows how spending
 * is distributed across different expense categories, enabling users to identify
 * their top spending areas. Used for pie charts, donut charts, and spending
 * analysis dashboards.
 *
 * @property totalSpent - Total amount spent across all categories
 * @property breakdown - Array of category items sorted by spending amount (descending)
 * @property currency - ISO 4217 currency code for all amounts
 * @property preset - Date range information for the query
 * @property preset.from - Start date of the period, or null if unbounded
 * @property preset.to - End date of the period, or null if unbounded
 * @property preset.value - Preset identifier (e.g., "THIS_QUARTER")
 * @property preset.label - Human-readable label (e.g., "This Quarter")
 *
 * @example
 * ```typescript
 * const breakdown: CategoryBreakdown = {
 *   totalSpent: 1500,
 *   breakdown: [
 *     { name: 'Food & Dining', value: 450, percentage: 30 },
 *     { name: 'Transportation', value: 300, percentage: 20 },
 *     { name: 'Entertainment', value: 225, percentage: 15 },
 *     { name: 'Shopping', value: 525, percentage: 35 }
 *   ],
 *   currency: 'USD',
 *   preset: {
 *     from: new Date('2024-01-01'),
 *     to: new Date('2024-03-31'),
 *     value: 'THIS_QUARTER',
 *     label: 'This Quarter'
 *   }
 * };
 * ```
 */
export interface CategoryBreakdown {
  totalSpent: number
  breakdown: CategoryBreakdownItem[]
  currency: string
  preset: {
    from?: Date | null
    to?: Date | null
    value: string
    label: string
  }
}

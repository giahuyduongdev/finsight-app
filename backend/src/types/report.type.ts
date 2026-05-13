/**
 * Report Type Definitions
 *
 * This module defines TypeScript interfaces and types for financial reports
 * and report generation. These types support automated report generation,
 * email delivery, AI-powered insights, and report summary data structures
 * used throughout the reporting system.
 *
 * @module types/report
 */

/**
 * Report Email Data Structure
 *
 * Complete data structure for generating and sending financial report emails.
 * Contains all financial metrics, top spending categories, AI-generated insights,
 * and formatting information needed to render professional report emails.
 *
 * @property period - Human-readable period label (e.g., "January 2024", "Q1 2024")
 * @property totalIncome - Total income amount for the report period
 * @property totalExpenses - Total expense amount for the report period
 * @property availableBalance - Net balance (income - expenses) for the period
 * @property savingsRate - Savings rate as a percentage (0-100)
 * @property topSpendingCategories - Top 3-5 spending categories with amounts and percentages
 * @property insights - Array of AI-generated financial insights and recommendations
 * @property currency - ISO 4217 currency code for all amounts (e.g., "USD", "EUR")
 *
 * @example
 * ```typescript
 * const emailData: ReportEmailData = {
 *   period: 'January 2024',
 *   totalIncome: 5000,
 *   totalExpenses: 3500,
 *   availableBalance: 1500,
 *   savingsRate: 30,
 *   topSpendingCategories: [
 *     { name: 'Food & Dining', amount: 1200, percent: 34.3 },
 *     { name: 'Transportation', amount: 800, percent: 22.9 },
 *     { name: 'Entertainment', amount: 500, percent: 14.3 }
 *   ],
 *   insights: [
 *     'Your savings rate increased by 5% compared to last month.',
 *     'Food & Dining spending is 20% higher than your 3-month average.',
 *     'Consider reviewing your subscription services to reduce recurring expenses.'
 *   ],
 *   currency: 'USD'
 * };
 * ```
 */
export interface ReportEmailData {
  period: string
  totalIncome: number
  totalExpenses: number
  availableBalance: number
  savingsRate: number
  topSpendingCategories: Array<{
    name: string
    amount: number
    percent: number
  }>
  insights: string[]
  currency: string
}

/**
 * Top Spending Category Item
 *
 * Represents a single category in the top spending categories list for reports.
 * Contains the category name, absolute spending amount, and percentage of total
 * spending. Used in report summaries and email templates.
 *
 * @property name - Category name (e.g., "Food & Dining", "Transportation")
 * @property amount - Total amount spent in this category
 * @property percent - Percentage of total spending (0-100)
 *
 * @example
 * ```typescript
 * const category: TopSpendingCategory = {
 *   name: 'Food & Dining',
 *   amount: 1200,
 *   percent: 34.3
 * };
 * ```
 */
export interface TopSpendingCategory {
  name: string
  amount: number
  percent: number
}

/**
 * Report Summary Data
 *
 * Aggregated financial summary for a report period. Contains core financial
 * metrics and top spending categories. This structure is used internally for
 * report generation and can be transformed into various output formats
 * (email, PDF, API response).
 *
 * @property income - Total income amount for the report period
 * @property expenses - Total expense amount for the report period
 * @property balance - Net balance (income - expenses)
 * @property savingsRate - Savings rate as a percentage (0-100)
 * @property topCategories - Array of top spending categories sorted by amount (descending)
 *
 * @example
 * ```typescript
 * const summary: ReportSummary = {
 *   income: 5000,
 *   expenses: 3500,
 *   balance: 1500,
 *   savingsRate: 30,
 *   topCategories: [
 *     { name: 'Food & Dining', amount: 1200, percent: 34.3 },
 *     { name: 'Transportation', amount: 800, percent: 22.9 },
 *     { name: 'Entertainment', amount: 500, percent: 14.3 }
 *   ]
 * };
 * ```
 */
export interface ReportSummary {
  income: number
  expenses: number
  balance: number
  savingsRate: number
  topCategories: TopSpendingCategory[]
}

/**
 * Generated Report Data Structure
 *
 * Complete generated report containing financial summary, AI insights, and
 * metadata. This is the primary output structure from the report generation
 * service and can be used for email delivery, API responses, or storage.
 *
 * @property period - Human-readable period label (e.g., "January 2024", "Q1 2024")
 * @property summary - Aggregated financial metrics and top spending categories
 * @property currency - ISO 4217 currency code for all amounts
 * @property insights - Array of AI-generated financial insights and recommendations
 *
 * @example
 * ```typescript
 * const report: GeneratedReport = {
 *   period: 'January 2024',
 *   summary: {
 *     income: 5000,
 *     expenses: 3500,
 *     balance: 1500,
 *     savingsRate: 30,
 *     topCategories: [
 *       { name: 'Food & Dining', amount: 1200, percent: 34.3 },
 *       { name: 'Transportation', amount: 800, percent: 22.9 }
 *     ]
 *   },
 *   currency: 'USD',
 *   insights: [
 *     'Your savings rate increased by 5% compared to last month.',
 *     'Consider reviewing your subscription services.'
 *   ]
 * };
 * ```
 */
export interface GeneratedReport {
  period: string
  summary: ReportSummary
  currency: string
  insights: string[]
}

/**
 * AI Insights Generation Input
 *
 * Input data structure for AI-powered financial insights generation. Contains
 * all financial metrics and category breakdowns needed for the AI model to
 * generate personalized insights, recommendations, and observations about the
 * user's financial behavior.
 *
 * @property totalIncome - Total income amount for the analysis period
 * @property totalExpenses - Total expense amount for the analysis period
 * @property availableBalance - Net balance (income - expenses)
 * @property savingsRate - Savings rate as a percentage (0-100)
 * @property categories - Category breakdown with amounts and percentages
 * @property periodLabel - Human-readable period label (e.g., "January 2024")
 * @property currency - ISO 4217 currency code (optional, defaults to USD)
 *
 * @example
 * ```typescript
 * const input: InsightsGenerationInput = {
 *   totalIncome: 5000,
 *   totalExpenses: 3500,
 *   availableBalance: 1500,
 *   savingsRate: 30,
 *   categories: {
 *     'Food & Dining': { amount: 1200, percentage: 34.3 },
 *     'Transportation': { amount: 800, percentage: 22.9 },
 *     'Entertainment': { amount: 500, percentage: 14.3 }
 *   },
 *   periodLabel: 'January 2024',
 *   currency: 'USD'
 * };
 * ```
 */
export interface InsightsGenerationInput {
  totalIncome: number
  totalExpenses: number
  availableBalance: number
  savingsRate: number
  categories: Record<string, { amount: number; percentage: number }>
  periodLabel: string
  currency?: string
}

/**
 * @deprecated Use ReportEmailData instead
 *
 * Legacy Type for Backward Compatibility
 *
 * This type is maintained for backward compatibility with older code that
 * may still reference it. New code should use ReportEmailData instead, which
 * provides the same structure with improved documentation and type safety.
 *
 * @see ReportEmailData
 */
export type ReportType = {
  period: string
  totalIncome: number
  totalExpenses: number
  availableBalance: number
  savingsRate: number
  topSpendingCategories: Array<{ name: string; percent: number }>
  insights: string[]
  currency?: string
}

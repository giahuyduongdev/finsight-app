/**
 * Type Definitions Central Export
 *
 * This module serves as the central export point for all type definitions
 * used throughout the backend application. It re-exports types from all
 * type definition modules, providing a single import location for consumers.
 *
 * Usage:
 * ```typescript
 * import { LoginResponse, TransactionFilters, PaginatedResult } from '@/types';
 * ```
 *
 * This barrel export pattern simplifies imports and provides a clear API
 * surface for the type system. All types are organized by domain (user,
 * transaction, analytics, etc.) in their respective modules.
 *
 * @module types
 */

// ─── User Types ───────────────────────────────────────────────────────────────

/**
 * User-related type definitions including user profiles, authentication,
 * and user document interfaces.
 *
 * @see ./user.type
 */
export * from './user.type'

// ─── Transaction Types ────────────────────────────────────────────────────────

/**
 * Transaction-related type definitions including bulk imports and
 * transaction processing results.
 *
 * @see ./transaction.type
 */
export * from './transaction.type'

// ─── Analytics Types ──────────────────────────────────────────────────────────

/**
 * Analytics and statistics type definitions including summary metrics,
 * chart data, and category breakdowns.
 *
 * @see ./analytics.type
 */
export * from './analytics.type'

// ─── Report Types ─────────────────────────────────────────────────────────────

/**
 * Financial report type definitions including report generation,
 * email data, and AI insights.
 *
 * @see ./report.type
 */
export * from './report.type'

// ─── Auth Types ───────────────────────────────────────────────────────────────

/**
 * Authentication type definitions including JWT tokens, OAuth flows,
 * and OTP verification.
 *
 * @see ./auth.type
 */
export * from './auth.type'

// ─── API Response Types ───────────────────────────────────────────────────────

/**
 * API response structure type definitions including success responses,
 * error responses, and pagination wrappers.
 *
 * @see ./api-response.type
 */
export * from './api-response.type'

// ─── Query Filter Types ───────────────────────────────────────────────────────

/**
 * Common query filter type definitions including date ranges, pagination,
 * and transaction filters.
 *
 * @see ./query-filters.type
 */
export * from './query-filters.type'

// ─── Repository Types ─────────────────────────────────────────────────────────

/**
 * Repository layer type definitions including pagination, filtering,
 * and query result structures.
 *
 * @see ./repository.type
 */
export * from './repository.type'

// ─── Validator Types ──────────────────────────────────────────────────────────

/**
 * Validator type definitions inferred from Zod schemas. Provides type-safe
 * request validation types for all API endpoints.
 *
 * @see ./validator.type
 */
export * from './validator.type'

// ─── DTO Types ────────────────────────────────────────────────────────────────

/**
 * Data Transfer Object type definitions for API responses and data
 * transformation layers.
 *
 * @see ./dto.type
 */
export * from './dto.type'

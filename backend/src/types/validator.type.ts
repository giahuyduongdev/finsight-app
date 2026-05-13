/**
 * Validator Type Definitions
 *
 * This module serves as a central export point for all validator types inferred
 * from Zod schemas. These types are automatically derived from the validation
 * schemas defined in the validators/ directory, ensuring type safety and
 * consistency between validation rules and TypeScript types.
 *
 * Official Documentation @ https://zod.dev/
 *
 * Zod is a TypeScript-first schema validation library that provides runtime
 * validation and automatic TypeScript type inference. All types in this module
 * are inferred from Zod schemas using the `z.infer<typeof schema>` pattern.
 *
 * @module types/validator
 */

// ─── Auth Validator Types ─────────────────────────────────────────────────────

/**
 * Authentication Validator Types
 *
 * Types inferred from authentication validation schemas. These types ensure
 * that authentication request data matches the validation rules defined in
 * auth.validator.ts. Includes types for registration, login, OTP verification,
 * password reset, and email/password change flows.
 *
 * @see ../validators/auth.validator
 */
export type {
  RegisterSchemaType,
  LoginSchemaType,
  RefreshTokenSchemaType,
  VerifyOTPSchemaType,
  ResendOTPSchemaType,
  ForgotPasswordSchemaType,
  VerifyForgotOTPSchemaType,
  ResetPasswordSchemaType,
  ChangePasswordRequestSchemaType,
  VerifyChangePasswordOTPSchemaType,
  ChangeEmailRequestSchemaType,
  VerifyChangeEmailOTPSchemaType
} from '../validators/auth.validator'

// ─── User Validator Types ─────────────────────────────────────────────────────

/**
 * User Validator Types
 *
 * Types inferred from user validation schemas. These types ensure that user
 * profile update and password change requests match the validation rules
 * defined in user.validator.ts.
 *
 * @see ../validators/user.validator
 */
export type {
  UpdateUserType,
  ChangePasswordSchemaType
} from '../validators/user.validator'

// ─── Transaction Validator Types ──────────────────────────────────────────────

/**
 * Transaction Validator Types
 *
 * Types inferred from transaction validation schemas. These types ensure that
 * transaction creation, update, and bulk delete requests match the validation
 * rules defined in transaction.validator.ts.
 *
 * @see ../validators/transaction.validator
 */
export type {
  CreateTransactionType,
  UpdateTransactionType,
  BulkDeleteTransactionType
} from '../validators/transaction.validator'

// ─── Report Validator Types ───────────────────────────────────────────────────

/**
 * Report Validator Types
 *
 * Types inferred from report validation schemas. These types ensure that
 * report setting updates match the validation rules defined in report.validator.ts.
 *
 * @see ../validators/report.validator
 */
export type { UpdateReportSettingType } from '../validators/report.validator'

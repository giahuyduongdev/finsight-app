import { RefreshTokenDocument } from '../../models/refresh-token.model'
import { DeleteResult } from '../../types/repository.types'

/**
 * Refresh Token Repository Interface
 * Defines contract for refresh token data access operations
 */
export interface IRefreshTokenRepository {
  /**
   * Create refresh token
   * @param tokenData - Partial refresh token data
   * @returns Created refresh token document
   */
  create(
    tokenData: Partial<RefreshTokenDocument>
  ): Promise<RefreshTokenDocument>

  /**
   * Find token by token string
   * @param token - Token string
   * @returns Refresh token document or null if not found
   */
  findByToken(token: string): Promise<RefreshTokenDocument | null>

  /**
   * Find tokens by user ID
   * @param userId - User ID
   * @returns Array of refresh token documents
   */
  findByUserId(userId: string): Promise<RefreshTokenDocument[]>

  /**
   * Revoke token by token string
   * @param token - Token string
   * @returns True if revoked, false if not found
   */
  revokeToken(token: string): Promise<boolean>

  /**
   * Delete all tokens for user ID
   * @param userId - User ID
   * @returns Delete result with count
   */
  deleteByUserId(userId: string): Promise<DeleteResult>

  /**
   * Delete expired tokens
   * @param currentDate - Current date to compare against expiresAt
   * @returns Delete result with count
   */
  deleteExpired(currentDate: Date): Promise<DeleteResult>
}

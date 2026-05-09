import RefreshTokenModel, {
  RefreshTokenDocument
} from '../models/refresh-token.model'
import { IRefreshTokenRepository } from './interfaces/refresh-token-repository.interface'
import { DeleteResult } from '../types/repository.types'
import { logger } from '../config/logger.config'

/**
 * Mask token for safe logging
 */
const maskToken = (token?: string) => {
  if (!token) return undefined
  if (token.length <= 12) return '[REDACTED]'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

/**
 * Refresh Token Repository Implementation
 * Handles data access operations for refresh tokens
 */
export class RefreshTokenRepository implements IRefreshTokenRepository {
  /**
   * Create refresh token
   */
  async create(
    tokenData: Partial<RefreshTokenDocument>
  ): Promise<RefreshTokenDocument> {
    try {
      const token = await RefreshTokenModel.create(tokenData)
      logger.info('[APP:Auth] Refresh token created', {
        tokenId: token._id,
        userId: token.userId
      })
      return token
    } catch (error) {
      logger.error('[APP:Auth] Error creating refresh token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: tokenData.userId
      })
      throw error
    }
  }

  /**
   * Find token by token string
   */
  async findByToken(token: string): Promise<RefreshTokenDocument | null> {
    try {
      return await RefreshTokenModel.findOne({ token }).exec()
    } catch (error) {
      logger.error('[APP:Auth] Error finding refresh token by token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        tokenPreview: maskToken(token)
      })
      throw error
    }
  }

  /**
   * Find tokens by user ID
   */
  async findByUserId(userId: string): Promise<RefreshTokenDocument[]> {
    try {
      return await RefreshTokenModel.find({ userId })
        .sort({ createdAt: -1 })
        .exec()
    } catch (error) {
      logger.error('[APP:Auth] Error finding refresh tokens by userId', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId
      })
      throw error
    }
  }

  /**
   * Revoke token by token string
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      const result = await RefreshTokenModel.updateOne(
        { token },
        { $set: { isRevoked: true } }
      ).exec()

      const revoked = result.modifiedCount > 0
      if (revoked) {
        logger.info('[APP:Auth] Refresh token revoked', {
          tokenPreview: maskToken(token)
        })
      }
      return revoked
    } catch (error) {
      logger.error('[APP:Auth] Error revoking refresh token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        tokenPreview: maskToken(token)
      })
      throw error
    }
  }

  /**
   * Delete all tokens for user ID
   */
  async deleteByUserId(userId: string): Promise<DeleteResult> {
    try {
      const result = await RefreshTokenModel.deleteMany({ userId }).exec()
      logger.info('[APP:Auth] Refresh tokens deleted by userId', {
        userId,
        deletedCount: result.deletedCount
      })
      return {
        deletedCount: result.deletedCount || 0
      }
    } catch (error) {
      logger.error('[APP:Auth] Error deleting refresh tokens by userId', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId
      })
      throw error
    }
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(currentDate: Date): Promise<DeleteResult> {
    try {
      const result = await RefreshTokenModel.deleteMany({
        expiresAt: { $lt: currentDate }
      }).exec()

      logger.info('[APP:Auth] Expired refresh tokens deleted', {
        deletedCount: result.deletedCount,
        currentDate
      })

      return {
        deletedCount: result.deletedCount || 0
      }
    } catch (error) {
      logger.error('[APP:Auth] Error deleting expired refresh tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        currentDate
      })
      throw error
    }
  }
}

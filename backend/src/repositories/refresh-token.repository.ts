import RefreshTokenModel, {
  RefreshTokenDocument
} from '../models/refresh-token.model'
import { IRefreshTokenRepository } from './interfaces/refresh-token-repository.interface'
import { DeleteResult } from '../types/repository.types'
import { logger } from '../config/logger.config'

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
      logger.info('Refresh token created', {
        tokenId: token._id,
        userId: token.userId
      })
      return token
    } catch (error) {
      logger.error('Error creating refresh token', { error, tokenData })
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
      logger.error('Error finding refresh token by token', { error, token })
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
      logger.error('Error finding refresh tokens by userId', { error, userId })
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
        logger.info('Refresh token revoked', { token })
      }
      return revoked
    } catch (error) {
      logger.error('Error revoking refresh token', { error, token })
      throw error
    }
  }

  /**
   * Delete all tokens for user ID
   */
  async deleteByUserId(userId: string): Promise<DeleteResult> {
    try {
      const result = await RefreshTokenModel.deleteMany({ userId }).exec()
      logger.info('Refresh tokens deleted by userId', {
        userId,
        deletedCount: result.deletedCount
      })
      return {
        deletedCount: result.deletedCount || 0
      }
    } catch (error) {
      logger.error('Error deleting refresh tokens by userId', {
        error,
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

      logger.info('Expired refresh tokens deleted', {
        deletedCount: result.deletedCount,
        currentDate
      })

      return {
        deletedCount: result.deletedCount || 0
      }
    } catch (error) {
      logger.error('Error deleting expired refresh tokens', {
        error,
        currentDate
      })
      throw error
    }
  }
}

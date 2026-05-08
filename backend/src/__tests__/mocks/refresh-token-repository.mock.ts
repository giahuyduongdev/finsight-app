/**
 * Mock RefreshTokenRepository for Unit Testing
 * Implements IRefreshTokenRepository interface with in-memory storage
 */

import { IRefreshTokenRepository } from '../../repositories/interfaces/refresh-token-repository.interface'
import { RefreshTokenDocument } from '../../models/refresh-token.model'
import { DeleteResult } from '../../types/repository.types'

export class MockRefreshTokenRepository implements IRefreshTokenRepository {
  private tokens: Map<string, RefreshTokenDocument> = new Map()

  /**
   * Create refresh token
   */
  async create(
    tokenData: Partial<RefreshTokenDocument>
  ): Promise<RefreshTokenDocument> {
    const mockToken = {
      _id: `mock-token-${Date.now()}`,
      userId: tokenData.userId,
      token: tokenData.token || `token-${Date.now()}`,
      expiresAt: tokenData.expiresAt || new Date(Date.now() + 86400000),
      isRevoked: tokenData.isRevoked || false,
      userAgent: tokenData.userAgent || '',
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as RefreshTokenDocument

    this.tokens.set(mockToken._id as unknown as string, mockToken)
    return mockToken
  }

  /**
   * Find token by token string
   */
  async findByToken(token: string): Promise<RefreshTokenDocument | null> {
    const tokens = Array.from(this.tokens.values())
    return tokens.find((t) => t.token === token) || null
  }

  /**
   * Find tokens by user ID
   */
  async findByUserId(userId: string): Promise<RefreshTokenDocument[]> {
    const tokens = Array.from(this.tokens.values())
    return tokens.filter((t) => t.userId.toString() === userId)
  }

  /**
   * Revoke token by token string
   */
  async revokeToken(token: string): Promise<boolean> {
    const tokens = Array.from(this.tokens.values())
    const foundToken = tokens.find((t) => t.token === token)

    if (!foundToken) return false

    foundToken.isRevoked = true
    this.tokens.set(foundToken._id as unknown as string, foundToken)
    return true
  }

  /**
   * Delete all tokens for user ID
   */
  async deleteByUserId(userId: string): Promise<DeleteResult> {
    const tokens = Array.from(this.tokens.entries())
    let deletedCount = 0

    for (const [id, token] of tokens) {
      if (token.userId.toString() === userId) {
        this.tokens.delete(id)
        deletedCount++
      }
    }

    return { deletedCount }
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(currentDate: Date): Promise<DeleteResult> {
    const tokens = Array.from(this.tokens.entries())
    let deletedCount = 0

    for (const [id, token] of tokens) {
      if (token.expiresAt < currentDate) {
        this.tokens.delete(id)
        deletedCount++
      }
    }

    return { deletedCount }
  }

  // ─── Test Helper Methods ──────────────────────────────────────────────────

  /**
   * Clear all tokens (for test cleanup)
   */
  clear(): void {
    this.tokens.clear()
  }

  /**
   * Get all tokens (for test assertions)
   */
  getAll(): RefreshTokenDocument[] {
    return Array.from(this.tokens.values())
  }

  /**
   * Get token count for user (for test assertions)
   */
  countByUserId(userId: string): number {
    return Array.from(this.tokens.values()).filter(
      (t) => t.userId.toString() === userId
    ).length
  }
}

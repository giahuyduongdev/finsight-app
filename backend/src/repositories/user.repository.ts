import { IUserRepository } from './interfaces/user-repository.interface'
import UserModel, { UserDocument } from '../models/user.model'
import { redis } from '../config/redis.config'

/**
 * User Repository Implementation
 * Handles all user data access operations
 */
export class UserRepository implements IUserRepository {
  /**
   * Find user by ID
   * @param userId - User ID
   * @returns User document or null if not found
   */
  async findById(userId: string): Promise<UserDocument | null> {
    return await UserModel.findById(userId)
  }

  /**
   * Find user by email address
   * @param email - User email
   * @returns User document or null if not found
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return await UserModel.findOne({ email })
  }

  /**
   * Create new user
   * @param userData - Partial user data
   * @returns Created user document
   */
  async create(userData: Partial<UserDocument>): Promise<UserDocument> {
    return await UserModel.create(userData)
  }

  /**
   * Update user profile information
   * Invalidates user cache after update
   * @param userId - User ID
   * @param updates - Partial user data to update
   * @returns Updated user document or null if not found
   */
  async update(
    userId: string,
    updates: Partial<UserDocument>
  ): Promise<UserDocument | null> {
    // Invalidate cache before update
    await redis.del(`user:${userId}`)

    return await UserModel.findByIdAndUpdate(userId, updates, { new: true })
  }

  /**
   * Update user password
   * @param userId - User ID
   * @param hashedPassword - Pre-hashed password
   * @returns Updated user document or null if not found
   */
  async updatePassword(
    userId: string,
    hashedPassword: string
  ): Promise<UserDocument | null> {
    return await UserModel.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true }
    )
  }
}

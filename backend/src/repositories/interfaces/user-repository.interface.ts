import { UserDocument } from '../../models/user.model'

/**
 * User Repository Interface
 * Defines contract for user data access operations
 */
export interface IUserRepository {
  /**
   * Find user by ID
   * @param userId - User ID
   * @returns User document or null if not found
   */
  findById(userId: string): Promise<UserDocument | null>

  /**
   * Find user by email address
   * @param email - User email
   * @returns User document or null if not found
   */
  findByEmail(email: string): Promise<UserDocument | null>

  /**
   * Create new user
   * @param userData - Partial user data
   * @returns Created user document
   */
  create(userData: Partial<UserDocument>): Promise<UserDocument>

  /**
   * Update user profile information
   * @param userId - User ID
   * @param updates - Partial user data to update
   * @returns Updated user document or null if not found
   */
  update(
    userId: string,
    updates: Partial<UserDocument>
  ): Promise<UserDocument | null>

  /**
   * Update user password
   * @param userId - User ID
   * @param hashedPassword - Pre-hashed password
   * @returns Updated user document or null if not found
   */
  updatePassword(
    userId: string,
    hashedPassword: string
  ): Promise<UserDocument | null>
}

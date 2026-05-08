import { NotFoundException, UnauthorizedException } from '../utils/errors/index'
import {
  ChangePasswordSchemaType,
  UpdateUserType
} from '../validators/user.validator'
import { compareValue, hashValue } from '../utils/bcrypt.util'
import { IUserRepository } from '../repositories/interfaces/user-repository.interface'
import { IRefreshTokenRepository } from '../repositories/interfaces/refresh-token-repository.interface'
import { UserDocument } from '../models/user.model'

// ─── UserService Class (New - DI-based) ──────────────────────────────────────

/**
 * UserService Class
 * Handles user-related business logic with dependency injection
 */
export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository
  ) {}

  /**
   * Find user by ID
   * @param userId - User ID
   * @returns User document without password, or null if not found
   */
  async findById(
    userId: string
  ): Promise<Omit<UserDocument, 'password'> | null> {
    const user = await this.userRepository.findById(userId)
    if (!user) return null
    return user.omitPassword()
  }

  /**
   * Find user by email
   * @param email - User email
   * @returns User document without password, or null if not found
   */
  async findByEmail(
    email: string
  ): Promise<Omit<UserDocument, 'password'> | null> {
    const user = await this.userRepository.findByEmail(email)
    if (!user) return null
    return user.omitPassword()
  }

  /**
   * Update user profile
   * @param userId - User ID
   * @param body - Update data
   * @param profilePic - Optional profile picture file
   * @returns Updated user document without password
   * @throws NotFoundException if user not found
   */
  async update(
    userId: string,
    body: UpdateUserType,
    profilePic?: Express.Multer.File
  ): Promise<Omit<UserDocument, 'password'>> {
    const user = await this.userRepository.findById(userId)
    if (!user) throw new NotFoundException('User not found')

    // Prepare update data
    const updateData: Partial<UserDocument> = {
      name: body.name,
      timezone: body.timezone,
      preferredCurrency: body.preferredCurrency
    }

    if (profilePic) {
      updateData.profilePicture = profilePic.path
    }

    // Update user
    const updatedUser = await this.userRepository.update(userId, updateData)
    if (!updatedUser) throw new NotFoundException('User not found')

    return updatedUser.omitPassword()
  }

  /**
   * Change user password
   * @param userId - User ID
   * @param body - Password change data
   * @returns Success message
   * @throws NotFoundException if user not found
   * @throws UnauthorizedException if current password is incorrect
   */
  async changePassword(
    userId: string,
    body: ChangePasswordSchemaType
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = body

    const user = await this.userRepository.findById(userId)
    if (!user) throw new NotFoundException('User not found')

    // Verify current password
    const isMatch = await compareValue(currentPassword, user.password)
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect')
    }

    // Hash new password
    const hashedPassword = await hashValue(newPassword)

    // Update password
    await this.userRepository.updatePassword(userId, hashedPassword)

    // Logout all devices by deleting all refresh tokens
    await this.refreshTokenRepository.deleteByUserId(userId)

    return {
      message: 'Password changed successfully. Please login again.'
    }
  }
}

// ─── Old Service Functions (Deprecated - Keep for backward compatibility) ────

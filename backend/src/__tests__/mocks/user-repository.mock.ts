/**
 * Mock UserRepository for Unit Testing
 * Implements IUserRepository interface with in-memory storage
 */

import { IUserRepository } from '../../repositories/interfaces/user-repository.interface'
import { UserDocument } from '../../models/user.model'

export class MockUserRepository implements IUserRepository {
  private users: Map<string, UserDocument> = new Map()

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<UserDocument | null> {
    return this.users.get(userId) || null
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    const users = Array.from(this.users.values())
    return users.find((u) => u.email === email) || null
  }

  /**
   * Create new user
   */
  async create(userData: Partial<UserDocument>): Promise<UserDocument> {
    const mockUser = {
      _id: `mock-user-${Date.now()}`,
      name: userData.name || 'Test User',
      email: userData.email || 'test@example.com',
      password: userData.password || 'hashed-password',
      profilePicture: userData.profilePicture || null,
      timezone: userData.timezone || 'UTC',
      preferredCurrency: userData.preferredCurrency || 'USD',
      role: userData.role || 'USER',
      auth0Ids: userData.auth0Ids || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      omitPassword: function (this: UserDocument) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...rest } = this.toObject
          ? this.toObject()
          : (this as unknown as Record<string, unknown>)
        return rest as Omit<UserDocument, 'password'>
      },
      comparePassword: async function (this: UserDocument, pwd: string) {
        return pwd === this.password
      }
    } as unknown as UserDocument

    this.users.set(mockUser._id as unknown as string, mockUser)
    return mockUser
  }

  /**
   * Update user
   */
  async update(
    userId: string,
    updates: Partial<UserDocument>
  ): Promise<UserDocument | null> {
    const user = this.users.get(userId)
    if (!user) return null

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date()
    } as UserDocument

    this.users.set(userId, updatedUser)
    return updatedUser
  }

  /**
   * Update password
   */
  async updatePassword(
    userId: string,
    hashedPassword: string
  ): Promise<UserDocument | null> {
    const user = this.users.get(userId)
    if (!user) return null

    user.password = hashedPassword
    user.updatedAt = new Date()

    this.users.set(userId, user)
    return user
  }

  // ─── Test Helper Methods ──────────────────────────────────────────────────

  /**
   * Clear all users (for test cleanup)
   */
  clear(): void {
    this.users.clear()
  }

  /**
   * Get all users (for test assertions)
   */
  getAll(): UserDocument[] {
    return Array.from(this.users.values())
  }

  /**
   * Seed a user directly (for test setup)
   */
  seed(user: UserDocument): void {
    this.users.set(user._id as unknown as string, user)
  }
}

/// <reference types="jest" />
/**
 * UserService Unit Tests
 * Tests business logic with mock repositories (no database required)
 */

import { UserService } from '../../services/user.service'
import { MockUserRepository } from '../mocks/user-repository.mock'
import {
  NotFoundException,
  UnauthorizedException
} from '../../utils/errors/index'
import { revokeAllUserSessions } from '../../services/session-revocation.service'

jest.mock('../../services/session-revocation.service', () => ({
  revokeAllUserSessions: jest.fn().mockResolvedValue(1)
}))

// Mock bcrypt utilities
jest.mock('../../utils/bcrypt.util', () => ({
  hashValue: jest.fn((password: string) =>
    Promise.resolve(`hashed-${password}`)
  ),
  compareValue: jest.fn((plain: string, hashed: string) => {
    // Simple mock: check if hashed version matches
    return Promise.resolve(hashed === `hashed-${plain}`)
  })
}))

describe('UserService', () => {
  let userService: UserService
  let mockUserRepository: MockUserRepository

  beforeEach(() => {
    // Initialize mocks
    mockUserRepository = new MockUserRepository()

    // Initialize service with mocks
    userService = new UserService(mockUserRepository)
  })

  afterEach(() => {
    // Clean up
    mockUserRepository.clear()
    jest.clearAllMocks()
  })

  // ─── findById Tests ───────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return user without password when user exists', async () => {
      // Arrange
      const mockUser = await mockUserRepository.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashed-password123',
        timezone: 'UTC',
        preferredCurrency: 'USD'
      })

      // Act
      const result = await userService.findById(
        mockUser._id as unknown as string
      )

      // Assert
      expect(result).toBeDefined()
      expect(result?.name).toBe('John Doe')
      expect(result?.email).toBe('john@example.com')
      expect(result).not.toHaveProperty('password') // Password should be omitted
    })

    it('should return null when user does not exist', async () => {
      // Act
      const result = await userService.findById('non-existent-id')

      // Assert
      expect(result).toBeNull()
    })
  })

  // ─── findByEmail Tests ────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('should return user without password when user exists', async () => {
      // Arrange
      await mockUserRepository.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'hashed-password456',
        timezone: 'America/New_York',
        preferredCurrency: 'EUR'
      })

      // Act
      const result = await userService.findByEmail('jane@example.com')

      // Assert
      expect(result).toBeDefined()
      expect(result?.name).toBe('Jane Doe')
      expect(result?.email).toBe('jane@example.com')
      expect(result?.timezone).toBe('America/New_York')
      expect(result).not.toHaveProperty('password')
    })

    it('should return null when user does not exist', async () => {
      // Act
      const result = await userService.findByEmail('nonexistent@example.com')

      // Assert
      expect(result).toBeNull()
    })
  })

  // ─── update Tests ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const mockUser = await mockUserRepository.create({
        name: 'Old Name',
        email: 'user@example.com',
        password: 'hashed-password',
        timezone: 'UTC',
        preferredCurrency: 'USD'
      })

      const updateData = {
        name: 'New Name',
        timezone: 'Asia/Tokyo',
        preferredCurrency: 'JPY'
      }

      // Act
      const result = await userService.update(
        mockUser._id as unknown as string,
        updateData
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.name).toBe('New Name')
      expect(result.timezone).toBe('Asia/Tokyo')
      expect(result.preferredCurrency).toBe('JPY')
      expect(result.email).toBe('user@example.com') // Email unchanged
      expect(result).not.toHaveProperty('password')
    })

    it('should update profile picture when provided', async () => {
      // Arrange
      const mockUser = await mockUserRepository.create({
        name: 'User',
        email: 'user@example.com',
        password: 'hashed-password',
        timezone: 'UTC',
        preferredCurrency: 'USD'
      })

      const mockFile = {
        path: 'https://cloudinary.com/image.jpg'
      } as Express.Multer.File

      const updateData = {
        name: 'User',
        timezone: 'UTC',
        preferredCurrency: 'USD'
      }

      // Act
      const result = await userService.update(
        mockUser._id as unknown as string,
        updateData,
        mockFile
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.profilePicture).toBe('https://cloudinary.com/image.jpg')
    })

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const updateData = {
        name: 'New Name',
        timezone: 'UTC',
        preferredCurrency: 'USD'
      }

      // Act & Assert
      await expect(
        userService.update('non-existent-id', updateData)
      ).rejects.toThrow(NotFoundException)

      await expect(
        userService.update('non-existent-id', updateData)
      ).rejects.toThrow('User not found')
    })
  })

  // ─── changePassword Tests ─────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should change password successfully with correct current password', async () => {
      // Arrange
      const mockUser = await mockUserRepository.create({
        name: 'User',
        email: 'user@example.com',
        password: 'hashed-oldpassword',
        timezone: 'UTC',
        preferredCurrency: 'USD'
      })

      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      }

      // Act
      const result = await userService.changePassword(
        mockUser._id as unknown as string,
        passwordData
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.message).toBe(
        'Password changed successfully. Please login again.'
      )

      // Verify password was updated
      const updatedUser = await mockUserRepository.findById(
        mockUser._id as unknown as string
      )
      expect(updatedUser?.password).toBe('hashed-newpassword123')

      expect(revokeAllUserSessions).toHaveBeenCalledWith(
        mockUser._id as unknown as string
      )
    })

    it('should throw UnauthorizedException when current password is incorrect', async () => {
      // Arrange
      const mockUser = await mockUserRepository.create({
        name: 'User',
        email: 'user@example.com',
        password: 'hashed-correctpassword',
        timezone: 'UTC',
        preferredCurrency: 'USD'
      })

      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      }

      // Act & Assert
      await expect(
        userService.changePassword(
          mockUser._id as unknown as string,
          passwordData
        )
      ).rejects.toThrow(UnauthorizedException)

      await expect(
        userService.changePassword(
          mockUser._id as unknown as string,
          passwordData
        )
      ).rejects.toThrow('Current password is incorrect')

      // Verify password was NOT changed
      const unchangedUser = await mockUserRepository.findById(
        mockUser._id as unknown as string
      )
      expect(unchangedUser?.password).toBe('hashed-correctpassword')
    })

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      }

      // Act & Assert
      await expect(
        userService.changePassword('non-existent-id', passwordData)
      ).rejects.toThrow(NotFoundException)

      await expect(
        userService.changePassword('non-existent-id', passwordData)
      ).rejects.toThrow('User not found')
    })

    it('should hash password before storing', async () => {
      // Arrange
      const mockUser = await mockUserRepository.create({
        name: 'User',
        email: 'user@example.com',
        password: 'hashed-oldpassword',
        timezone: 'UTC',
        preferredCurrency: 'USD'
      })

      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'plainNewPassword',
        confirmPassword: 'plainNewPassword'
      }

      // Act
      await userService.changePassword(
        mockUser._id as unknown as string,
        passwordData
      )

      // Assert
      const updatedUser = await mockUserRepository.findById(
        mockUser._id as unknown as string
      )
      // Password should be hashed (prefixed with 'hashed-' by our mock)
      expect(updatedUser?.password).toBe('hashed-plainNewPassword')
      expect(updatedUser?.password).not.toBe('plainNewPassword')
    })
  })
})

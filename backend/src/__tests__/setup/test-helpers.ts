import jwt, { SignOptions } from 'jsonwebtoken'
import UserModel from '../../models/user.model'
import { hashValue } from '../../utils/bcrypt.util'

// Read directly from process.env for testing (not from Env object)
// because Env is loaded before jest.setup.js sets the environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing'
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key-for-testing'

type TimeUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'y'
type TimeString = `${number}${TimeUnit}`

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '15m') as TimeString
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ||
  '7d') as TimeString

/**
 * Generate JWT access token for testing
 */
export const generateAccessToken = (userId: string): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN
  }
  return jwt.sign({ userId }, JWT_SECRET, options)
}

/**
 * Generate JWT refresh token for testing
 */
export const generateRefreshToken = (userId: string): string => {
  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN
  }
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, options)
}

/**
 * Create a test user in the database
 */
export const createTestUser = async (overrides?: {
  email?: string
  password?: string
  fullName?: string
  isVerified?: boolean
}) => {
  const hashedPassword = await hashValue(overrides?.password || 'Password123!')

  const user = await UserModel.create({
    email: overrides?.email || 'test@example.com',
    password: hashedPassword,
    fullName: overrides?.fullName || 'Test User',
    isVerified: overrides?.isVerified ?? true,
    role: 'USER',
    timezone: 'UTC'
  })

  return user
}

/**
 * Create authenticated test user with access token
 */
export const createAuthenticatedUser = async (overrides?: {
  email?: string
  password?: string
  fullName?: string
}) => {
  const user = await createTestUser(overrides)
  const accessToken = generateAccessToken(user._id.toString())
  const refreshToken = generateRefreshToken(user._id.toString())

  return {
    user,
    accessToken,
    refreshToken
  }
}

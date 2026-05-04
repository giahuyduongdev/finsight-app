import crypto from 'crypto'
import { Env } from '../config/env.config'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 64

/**
 * Encrypt sensitive data before storing in Redis
 * Uses AES-256-GCM for authenticated encryption
 */
export const encrypt = (text: string): string => {
  // Generate a random salt for key derivation
  const salt = crypto.randomBytes(SALT_LENGTH)

  // Derive key from secret using PBKDF2
  const key = crypto.pbkdf2Sync(
    Env.JWT_SECRET, // Use existing secret as base
    salt,
    100000, // iterations
    32, // key length
    'sha256'
  )

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  // Encrypt
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Get auth tag
  const authTag = cipher.getAuthTag()

  // Combine: salt + iv + authTag + encrypted
  // Format: salt(64) + iv(16) + authTag(16) + encrypted
  return (
    salt.toString('hex') +
    iv.toString('hex') +
    authTag.toString('hex') +
    encrypted
  )
}

/**
 * Decrypt data from Redis
 */
export const decrypt = (encryptedData: string): string => {
  // Extract components
  const saltHex = encryptedData.slice(0, SALT_LENGTH * 2)
  const ivHex = encryptedData.slice(
    SALT_LENGTH * 2,
    SALT_LENGTH * 2 + IV_LENGTH * 2
  )
  const authTagHex = encryptedData.slice(
    SALT_LENGTH * 2 + IV_LENGTH * 2,
    SALT_LENGTH * 2 + IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2
  )
  const encrypted = encryptedData.slice(
    SALT_LENGTH * 2 + IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2
  )

  // Convert from hex
  const salt = Buffer.from(saltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  // Derive key using same parameters
  const key = crypto.pbkdf2Sync(Env.JWT_SECRET, salt, 100000, 32, 'sha256')

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  // Decrypt
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

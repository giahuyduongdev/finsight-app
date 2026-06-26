import crypto from 'crypto'
import { redis } from '../config/redis.config'
import { logger } from '../config/logger.config'

const USER_EMAIL_BITMAP_KEY = 'bitmap:users:email:v1'
const USER_EMAIL_BITMAP_READY_KEY = 'bitmap:users:email:v1:ready'
const USER_EMAIL_BITMAP_SIZE = 134_217_728
const NEGATIVE_EMAIL_CACHE_TTL_SECONDS = 300

export const AUTH_USER_LOOKUP_KEYS = {
  USER_EMAIL_BITMAP: USER_EMAIL_BITMAP_KEY,
  USER_EMAIL_BITMAP_READY: USER_EMAIL_BITMAP_READY_KEY
} as const

type UserEmailPresence =
  | { status: 'not_ready' }
  | { status: 'definitely_absent' }
  | { status: 'maybe_present' }

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)

  for (let i = 0; i < 256; i += 1) {
    let current = i
    for (let bit = 0; bit < 8; bit += 1) {
      current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1
    }
    table[i] = current >>> 0
  }

  return table
})()

const canonicalizeEmail = (email: string): string => email.trim().toLowerCase()

const crc32 = (value: string): number => {
  let crc = 0xffffffff
  const bytes = Buffer.from(value)

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

export const getUserEmailLookupHash = (email: string): string =>
  crypto.createHash('sha256').update(canonicalizeEmail(email)).digest('hex')

export const getUserEmailBitmapIndex = (email: string): number =>
  crc32(canonicalizeEmail(email)) % USER_EMAIL_BITMAP_SIZE

export const getUserEmailCacheKey = (email: string): string =>
  `user:email:${getUserEmailLookupHash(email)}`

export const getNegativeUserEmailCacheKey = (email: string): string =>
  `nf:email:${getUserEmailLookupHash(email)}`

export const isUserEmailBitmapReady = async (): Promise<boolean> => {
  try {
    return (await redis.get(USER_EMAIL_BITMAP_READY_KEY)) === '1'
  } catch {
    logger.warn('[APP:AuthLookup] Bitmap readiness check failed')
    return false
  }
}

export const markUserEmailBitmapReady = async (): Promise<void> => {
  await redis.set(USER_EMAIL_BITMAP_READY_KEY, '1')
}

export const clearUserEmailBitmapReady = async (): Promise<void> => {
  await redis.del(USER_EMAIL_BITMAP_READY_KEY)
}

export const getUserEmailPresence = async (
  email: string
): Promise<UserEmailPresence> => {
  const ready = await isUserEmailBitmapReady()
  if (!ready) {
    logger.debug('[APP:AuthLookup] Bitmap not ready', {
      emailHash: getUserEmailLookupHash(email)
    })
    return { status: 'not_ready' }
  }

  try {
    const bit = await redis.getbit(
      USER_EMAIL_BITMAP_KEY,
      getUserEmailBitmapIndex(email)
    )

    logger.debug('[APP:AuthLookup] Bitmap lookup completed', {
      emailHash: getUserEmailLookupHash(email),
      bit
    })

    return bit === 1
      ? { status: 'maybe_present' }
      : { status: 'definitely_absent' }
  } catch {
    logger.warn('[APP:AuthLookup] Bitmap lookup failed', {
      emailHash: getUserEmailLookupHash(email)
    })
    return { status: 'not_ready' }
  }
}

export const getCachedUserIdByEmail = async (
  email: string
): Promise<string | null> => {
  try {
    const cached = await redis.get(getUserEmailCacheKey(email))
    if (!cached) return null

    const parsed: unknown = JSON.parse(cached)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'userId' in parsed &&
      typeof parsed.userId === 'string'
    ) {
      logger.debug('[APP:AuthLookup] Positive email cache hit', {
        emailHash: getUserEmailLookupHash(email)
      })
      return parsed.userId
    }
  } catch {
    return null
  }

  return null
}

export const setCachedUserEmail = async (
  email: string,
  userId: string
): Promise<void> => {
  try {
    await redis.set(getUserEmailCacheKey(email), JSON.stringify({ userId }))
  } catch {
    // Lookup cache writes are best-effort; MongoDB remains authoritative.
  }
}

export const getNegativeUserEmailCache = async (
  email: string
): Promise<boolean> => {
  try {
    const hit = (await redis.get(getNegativeUserEmailCacheKey(email))) === '1'
    if (hit) {
      logger.debug('[APP:AuthLookup] Negative email cache hit', {
        emailHash: getUserEmailLookupHash(email)
      })
    }
    return hit
  } catch {
    return false
  }
}

export const setNegativeUserEmailCache = async (
  email: string
): Promise<void> => {
  try {
    logger.debug('[APP:AuthLookup] Setting negative email cache', {
      emailHash: getUserEmailLookupHash(email)
    })
    await redis.set(
      getNegativeUserEmailCacheKey(email),
      '1',
      'EX',
      NEGATIVE_EMAIL_CACHE_TTL_SECONDS
    )
  } catch {
    // Negative cache is an optimization only.
  }
}

export const clearNegativeUserEmailCache = async (
  email: string
): Promise<void> => {
  try {
    await redis.del(getNegativeUserEmailCacheKey(email))
  } catch {
    // Negative cache is an optimization only.
  }
}

export const deleteCachedUserEmail = async (email: string): Promise<void> => {
  try {
    await redis.del(getUserEmailCacheKey(email))
  } catch {
    // Lookup cache is an optimization only.
  }
}

export const markUserEmailPresent = async (email: string): Promise<void> => {
  try {
    await redis.setbit(USER_EMAIL_BITMAP_KEY, getUserEmailBitmapIndex(email), 1)
  } catch {
    // Presence filter writes are best-effort; MongoDB remains authoritative.
  }
}

export const syncExistingUserEmailLookup = async (
  email: string,
  userId: string
): Promise<void> => {
  await Promise.all([
    setCachedUserEmail(email, userId),
    markUserEmailPresent(email),
    clearNegativeUserEmailCache(email)
  ])
}

export const syncChangedUserEmailLookup = async (
  oldEmail: string,
  newEmail: string,
  userId: string
): Promise<void> => {
  await Promise.all([
    deleteCachedUserEmail(oldEmail),
    syncExistingUserEmailLookup(newEmail, userId)
  ])
}

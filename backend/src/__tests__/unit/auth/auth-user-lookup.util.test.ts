const redisGet = jest.fn()
const redisGetBit = jest.fn()
const redisSet = jest.fn()
const redisSetBit = jest.fn()
const redisDel = jest.fn()

jest.mock('../../../config/redis.config', () => ({
  redis: {
    get: redisGet,
    getbit: redisGetBit,
    set: redisSet,
    setbit: redisSetBit,
    del: redisDel
  }
}))

import {
  getNegativeUserEmailCacheKey,
  getUserEmailCacheKey,
  getUserEmailPresence,
  markUserEmailPresent,
  setNegativeUserEmailCache,
  syncChangedUserEmailLookup,
  syncExistingUserEmailLookup
} from '../../../utils/auth-user-lookup.util'

describe('auth user lookup utility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redisGet.mockResolvedValue(null)
    redisGetBit.mockResolvedValue(0)
    redisSet.mockResolvedValue('OK')
    redisSetBit.mockResolvedValue(0)
    redisDel.mockResolvedValue(1)
  })

  it('uses hashed lookup keys instead of raw email addresses', () => {
    const email = 'User@Example.com'

    expect(getUserEmailCacheKey(email)).toMatch(/^user:email:[a-f0-9]{64}$/)
    expect(getNegativeUserEmailCacheKey(email)).toMatch(
      /^nf:email:[a-f0-9]{64}$/
    )
    expect(getUserEmailCacheKey(email)).not.toContain('User@Example.com')
    expect(getNegativeUserEmailCacheKey(email)).not.toContain(
      'User@Example.com'
    )
    expect(getUserEmailCacheKey(email)).toBe(
      getUserEmailCacheKey(' user@example.com ')
    )
  })

  it('does not read the bitmap when the ready flag is missing', async () => {
    redisGet.mockResolvedValueOnce(null)

    await expect(getUserEmailPresence('user@example.com')).resolves.toEqual({
      status: 'not_ready'
    })
    expect(redisGet).toHaveBeenCalledWith('bitmap:users:email:v1:ready')
    expect(redisGetBit).not.toHaveBeenCalled()
  })

  it('returns definitely absent when the ready bitmap bit is zero', async () => {
    redisGet.mockResolvedValueOnce('1')
    redisGetBit.mockResolvedValueOnce(0)

    await expect(getUserEmailPresence('user@example.com')).resolves.toEqual({
      status: 'definitely_absent'
    })
    expect(redisGetBit).toHaveBeenCalledWith(
      'bitmap:users:email:v1',
      expect.any(Number)
    )
  })

  it('returns maybe present when the ready bitmap bit is one', async () => {
    redisGet.mockResolvedValueOnce('1')
    redisGetBit.mockResolvedValueOnce(1)

    await expect(getUserEmailPresence('user@example.com')).resolves.toEqual({
      status: 'maybe_present'
    })
  })

  it('stores negative cache entries with the configured TTL', async () => {
    await setNegativeUserEmailCache('missing@example.com')

    expect(redisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^nf:email:[a-f0-9]{64}$/),
      '1',
      'EX',
      300
    )
  })

  it('marks an email present in the versioned bitmap', async () => {
    await markUserEmailPresent('user@example.com')

    expect(redisSetBit).toHaveBeenCalledWith(
      'bitmap:users:email:v1',
      expect.any(Number),
      1
    )
  })

  it('syncs changed email lookup state', async () => {
    await syncChangedUserEmailLookup(
      'old@example.com',
      'new@example.com',
      'user-id'
    )

    expect(redisDel).toHaveBeenCalledWith(
      expect.stringMatching(/^user:email:[a-f0-9]{64}$/)
    )
    expect(redisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^user:email:[a-f0-9]{64}$/),
      JSON.stringify({ userId: 'user-id' })
    )
  })

  it('syncs an existing user lookup without throwing on cache failures', async () => {
    redisSet.mockRejectedValueOnce(new Error('redis down'))

    await expect(
      syncExistingUserEmailLookup('user@example.com', 'user-id')
    ).resolves.toBeUndefined()
  })
})

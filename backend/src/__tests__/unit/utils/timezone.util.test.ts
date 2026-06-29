import {
  isValidTimezone,
  normalizeTimezone
} from '../../../utils/timezone.util'

describe('timezone util', () => {
  it('returns undefined for missing or empty timezone values', () => {
    expect(normalizeTimezone()).toBeUndefined()
    expect(normalizeTimezone('')).toBeUndefined()
    expect(normalizeTimezone('   ')).toBeUndefined()
  })

  it('accepts canonical Vietnam timezone', () => {
    expect(isValidTimezone('Asia/Ho_Chi_Minh')).toBe(true)
    expect(normalizeTimezone('Asia/Ho_Chi_Minh')).toBe('Asia/Ho_Chi_Minh')
  })

  it('normalizes Asia/Saigon to Asia/Ho_Chi_Minh', () => {
    expect(normalizeTimezone('Asia/Saigon')).toBe('Asia/Ho_Chi_Minh')
  })

  it('accepts valid non-dropdown IANA timezone values', () => {
    expect(normalizeTimezone('America/Denver')).toBe('America/Denver')
  })

  it('rejects invalid timezone values', () => {
    expect(isValidTimezone('Mars/Base')).toBe(false)
    expect(normalizeTimezone('Mars/Base')).toBeUndefined()
  })
})

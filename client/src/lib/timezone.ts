const TIMEZONE_ALIASES: Record<string, string> = {
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Ho_Chi_Minh': 'Asia/Ho_Chi_Minh'
}

export const isValidTimeZone = (value: string): boolean => {
  const timezone = value.trim()
  if (!timezone) return false

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

export const normalizeTimeZone = (value?: string): string | undefined => {
  const timezone = value?.trim()
  if (!timezone) return undefined

  const normalized = TIMEZONE_ALIASES[timezone] ?? timezone
  return isValidTimeZone(normalized) ? normalized : undefined
}

export const getBrowserTimeZone = (): string | undefined =>
  normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)

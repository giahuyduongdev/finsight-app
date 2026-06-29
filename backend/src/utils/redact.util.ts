/**
 * List of sensitive field names that should be redacted
 * Case-insensitive matching will be applied
 */
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'authorization',
  'apikey',
  'secret',
  'accesstoken',
  'refreshtoken'
]

const EMAIL_FIELD = 'email'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

export const maskEmail = (value: unknown): unknown => {
  if (typeof value !== 'string') return value

  const atIndex = value.indexOf('@')
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@')) return value

  const localPart = value.slice(0, atIndex)
  const domain = value.slice(atIndex + 1)
  if (!localPart || !domain) return value

  return `${localPart[0]}***@${domain}`
}

const redactValue = (key: string, value: unknown): unknown => {
  const normalizedKey = key.toLowerCase()

  if (SENSITIVE_FIELDS.includes(normalizedKey)) return '[REDACTED]'
  if (normalizedKey === EMAIL_FIELD) return maskEmail(value)

  return undefined
}

/**
 * Recursively redacts sensitive fields in an object
 * @param obj - The object to redact
 * @param seen - WeakSet to track visited objects and prevent cycles
 * @returns A new object with sensitive fields replaced with "[REDACTED]"
 */
export const redactSensitiveFields = (
  obj: unknown,
  seen = new WeakSet<object>()
): unknown => {
  // Handle null, undefined, or non-object types
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (seen.has(obj)) return '[Circular]'
    seen.add(obj)
    return obj.map((item) => redactSensitiveFields(item, seen))
  }

  // Only recurse into plain objects, preserve special objects (Date, Error, etc.)
  if (!isPlainObject(obj)) {
    // Special handling for Error objects - redact own properties
    if (obj instanceof Error) {
      const redactedError: Record<string, unknown> = {
        name: obj.name,
        message: obj.message,
        stack: obj.stack
      }
      // Redact any additional own properties on the Error object
      for (const key of Object.getOwnPropertyNames(obj)) {
        if (key !== 'name' && key !== 'message' && key !== 'stack') {
          const value = (obj as unknown as Record<string, unknown>)[key]
          const redactedValue = redactValue(key, value)
          if (redactedValue !== undefined) {
            redactedError[key] = redactedValue
          } else {
            redactedError[key] = redactSensitiveFields(value, seen)
          }
        }
      }
      return redactedError
    }
    return obj
  }

  // Check for circular reference
  if (seen.has(obj)) {
    return '[Circular]'
  }
  seen.add(obj)

  // Handle objects
  const redacted: Record<string, unknown> = {}
  const objRecord = obj as Record<string, unknown>

  for (const [key, value] of Object.entries(objRecord)) {
    // Check if key is a sensitive field (case-insensitive)
    const redactedValue = redactValue(key, value)
    if (redactedValue !== undefined) {
      redacted[key] = redactedValue
    } else if (typeof value === 'object' && value !== null) {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveFields(value, seen)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

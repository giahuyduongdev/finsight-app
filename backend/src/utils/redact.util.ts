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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

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
  if (!isPlainObject(obj) || obj instanceof Date || obj instanceof Error) {
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
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      redacted[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveFields(value, seen)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

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

/**
 * Recursively redacts sensitive fields in an object
 * @param obj - The object to redact
 * @returns A new object with sensitive fields replaced with "[REDACTED]"
 */
export const redactSensitiveFields = (obj: unknown): unknown => {
  // Handle null, undefined, or non-object types
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveFields(item))
  }

  // Handle objects
  const redacted: Record<string, unknown> = {}
  const objRecord = obj as Record<string, unknown>

  for (const key in objRecord) {
    if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
      // Check if key is a sensitive field (case-insensitive)
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]'
      } else if (
        typeof objRecord[key] === 'object' &&
        objRecord[key] !== null
      ) {
        // Recursively redact nested objects
        redacted[key] = redactSensitiveFields(objRecord[key])
      } else {
        redacted[key] = objRecord[key]
      }
    }
  }

  return redacted
}

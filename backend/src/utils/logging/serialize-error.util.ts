import { redactSensitiveFields } from './redact.util'

const ERROR_FIELDS = [
  'name',
  'message',
  'stack',
  'code',
  'status',
  'statusCode',
  'http_code',
  'errno',
  'syscall',
  'response'
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const safeRead = (source: Record<string, unknown>, key: string): unknown => {
  try {
    return source[key]
  } catch {
    return '<unavailable>'
  }
}

const safeOwnPropertyNames = (value: object): string[] => {
  try {
    return Object.getOwnPropertyNames(value)
  } catch {
    return []
  }
}

const toPlainValue = (
  value: unknown,
  seen = new WeakSet<object>()
): unknown => {
  if (!isRecord(value)) return value

  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  if (value instanceof Error) {
    const errorRecord = value as unknown as Record<string, unknown>
    const serialized: Record<string, unknown> = {
      name: safeRead(errorRecord, 'name'),
      message: safeRead(errorRecord, 'message'),
      stack: safeRead(errorRecord, 'stack')
    }

    for (const key of safeOwnPropertyNames(value)) {
      if (!(key in serialized)) {
        serialized[key] = toPlainValue(safeRead(errorRecord, key), seen)
      }
    }

    return serialized
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPlainValue(item, seen))
  }

  const serialized: Record<string, unknown> = {}

  for (const key of safeOwnPropertyNames(value)) {
    serialized[key] = toPlainValue(safeRead(value, key), seen)
  }

  return serialized
}

export const serializeError = (error: unknown): Record<string, unknown> => {
  try {
    if (error instanceof Error) {
      return redactSensitiveFields(toPlainValue(error)) as Record<
        string,
        unknown
      >
    }

    if (isRecord(error)) {
      const source = error as Record<string, unknown>
      const serialized: Record<string, unknown> = {}

      for (const field of ERROR_FIELDS) {
        if (field in source) {
          serialized[field] = toPlainValue(safeRead(source, field))
        }
      }

      for (const key of safeOwnPropertyNames(source)) {
        if (!(key in serialized)) {
          serialized[key] = toPlainValue(safeRead(source, key))
        }
      }

      return redactSensitiveFields(serialized) as Record<string, unknown>
    }

    return redactSensitiveFields({
      message: String(error)
    }) as Record<string, unknown>
  } catch {
    return { message: '<unavailable>' }
  }
}

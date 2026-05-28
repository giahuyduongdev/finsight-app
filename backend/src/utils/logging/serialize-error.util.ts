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

export const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack
    }

    for (const key of Object.getOwnPropertyNames(error)) {
      if (!(key in serialized)) {
        serialized[key] = (error as unknown as Record<string, unknown>)[key]
      }
    }

    return redactSensitiveFields(serialized) as Record<string, unknown>
  }

  if (isRecord(error)) {
    const serialized: Record<string, unknown> = {}

    for (const field of ERROR_FIELDS) {
      if (field in error) {
        serialized[field] = error[field]
      }
    }

    for (const [key, value] of Object.entries(error)) {
      if (!(key in serialized)) {
        serialized[key] = value
      }
    }

    return redactSensitiveFields(serialized) as Record<string, unknown>
  }

  return redactSensitiveFields({
    message: String(error)
  }) as Record<string, unknown>
}

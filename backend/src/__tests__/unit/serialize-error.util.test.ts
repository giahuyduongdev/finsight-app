import { serializeError } from '../../utils/logging/serialize-error.util'

describe('serializeError', () => {
  it('should serialize Error instances with stack and own fields', () => {
    const error = new Error('Upload failed') as Error & { code: string }
    error.code = 'UPLOAD_FAILED'

    expect(serializeError(error)).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'Upload failed',
        stack: expect.any(String),
        code: 'UPLOAD_FAILED'
      })
    )
  })

  it('should serialize object errors without losing Cloudinary fields', () => {
    expect(
      serializeError({
        message: 'Invalid Signature',
        http_code: 401,
        request_id: 'cloudinary-request-id'
      })
    ).toEqual({
      message: 'Invalid Signature',
      http_code: 401,
      request_id: 'cloudinary-request-id'
    })
  })

  it('should serialize primitive errors as messages', () => {
    expect(serializeError('timeout')).toEqual({ message: 'timeout' })
  })

  it('should pass primitive error fallback through the redaction helper', () => {
    expect(serializeError(undefined)).toEqual({ message: 'undefined' })
  })

  it('should redact sensitive fields', () => {
    expect(
      serializeError({
        message: 'Auth failed',
        request_options: {
          auth: 'api-key:api-secret'
        },
        token: 'secret-token'
      })
    ).toEqual({
      message: 'Auth failed',
      request_options: {
        auth: '[REDACTED]'
      },
      token: '[REDACTED]'
    })
  })
})

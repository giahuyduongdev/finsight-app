import { z } from 'zod'
import {
  getUserMessage,
  USER_MESSAGE_MAP
} from '../../../utils/userMessage.util'
import { ErrorCodeEnum } from '../../../enums/error-code.enum'

describe('userMessage.util', () => {
  describe('USER_MESSAGE_MAP', () => {
    it('should have mappings for all error codes in ErrorCodeEnum', () => {
      const errorCodes = Object.keys(ErrorCodeEnum)
      const mappedCodes = Object.keys(USER_MESSAGE_MAP)

      expect(mappedCodes.sort()).toEqual(errorCodes.sort())
    })

    it('should have non-empty messages for all error codes', () => {
      Object.entries(USER_MESSAGE_MAP).forEach(([_code, message]) => {
        expect(message).toBeTruthy()
        expect(message.length).toBeGreaterThan(0)
        expect(typeof message).toBe('string')
      })
    })

    it('should have user-friendly messages without technical jargon', () => {
      Object.entries(USER_MESSAGE_MAP).forEach(([_code, message]) => {
        // Messages should not contain technical terms
        expect(message.toLowerCase()).not.toContain('stack')
        expect(message.toLowerCase()).not.toContain('exception')
        expect(message.toLowerCase()).not.toContain('null')
        expect(message.toLowerCase()).not.toContain('undefined')
      })
    })
  })

  describe('getUserMessage', () => {
    describe('ZodError handling', () => {
      it('should return validation error message for ZodError', () => {
        const schema = z.object({ email: z.string().email() })
        try {
          schema.parse({ email: 'invalid' })
        } catch (error) {
          const message = getUserMessage(error, 400)
          expect(message).toBe('Please check your input and try again')
        }
      })
    })

    describe('Error code mapping', () => {
      it('should map ACCESS_UNAUTHORIZED to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.ACCESS_UNAUTHORIZED }
        const message = getUserMessage(error, 401)
        expect(message).toBe(
          'Authentication failed. Please check your credentials'
        )
      })

      it('should map ACCESS_FORBIDDEN to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.ACCESS_FORBIDDEN }
        const message = getUserMessage(error, 403)
        expect(message).toBe(
          'You do not have permission to perform this action'
        )
      })

      it('should map AUTH_USER_NOT_FOUND to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.AUTH_USER_NOT_FOUND }
        const message = getUserMessage(error, 404)
        expect(message).toBe(
          "We couldn't find your account. Please check and try again"
        )
      })

      it('should map AUTH_EMAIL_ALREADY_EXISTS to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.AUTH_EMAIL_ALREADY_EXISTS }
        const message = getUserMessage(error, 409)
        expect(message).toBe(
          'This email is already registered. Please log in or use a different email'
        )
      })

      it('should map AUTH_INVALID_TOKEN to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.AUTH_INVALID_TOKEN }
        const message = getUserMessage(error, 401)
        expect(message).toBe('Your session has expired. Please log in again')
      })

      it('should map AUTH_OTP_EXPIRED to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.AUTH_OTP_EXPIRED }
        const message = getUserMessage(error, 400)
        expect(message).toBe('Verification failed. Please request a new code')
      })

      it('should map AUTH_OTP_TOO_MANY_REQUESTS to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.AUTH_OTP_TOO_MANY_REQUESTS }
        const message = getUserMessage(error, 429)
        expect(message).toBe('Too many requests. Please try again later')
      })

      it('should map VALIDATION_ERROR to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.VALIDATION_ERROR }
        const message = getUserMessage(error, 400)
        expect(message).toBe('Please check your input and try again')
      })

      it('should map RESOURCE_NOT_FOUND to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.RESOURCE_NOT_FOUND }
        const message = getUserMessage(error, 404)
        expect(message).toBe('The requested resource was not found')
      })

      it('should map FILE_UPLOAD_ERROR to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.FILE_UPLOAD_ERROR }
        const message = getUserMessage(error, 400)
        expect(message).toBe(
          'File upload failed. Please check the file and try again'
        )
      })

      it('should map REQUEST_TIMEOUT to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.REQUEST_TIMEOUT }
        const message = getUserMessage(error, 408)
        expect(message).toBe('The request took too long. Please try again')
      })

      it('should map REQUEST_TOO_LARGE to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.REQUEST_TOO_LARGE }
        const message = getUserMessage(error, 413)
        expect(message).toBe(
          'The request is too large. Please reduce the size and try again'
        )
      })

      it('should map UNSUPPORTED_MEDIA_TYPE to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.UNSUPPORTED_MEDIA_TYPE }
        const message = getUserMessage(error, 415)
        expect(message).toBe(
          'The file type is not supported. Please use a different format'
        )
      })

      it('should map INTERNAL_SERVER_ERROR to user-friendly message', () => {
        const error = { errorCode: ErrorCodeEnum.INTERNAL_SERVER_ERROR }
        const message = getUserMessage(error, 500)
        expect(message).toBe('Something went wrong. Please try again later')
      })
    })

    describe('Status code fallback', () => {
      it('should return generic 5xx message for unknown error with 500 status', () => {
        const error = { errorCode: 'UNKNOWN_ERROR' }
        const message = getUserMessage(error, 500)
        expect(message).toBe('Something went wrong. Please try again later')
      })

      it('should return generic 5xx message for unknown error with 503 status', () => {
        const error = { message: 'Service unavailable' }
        const message = getUserMessage(error, 503)
        expect(message).toBe('Something went wrong. Please try again later')
      })

      it('should return generic message for unknown error with 4xx status', () => {
        const error = { errorCode: 'UNKNOWN_ERROR' }
        const message = getUserMessage(error, 400)
        expect(message).toBe('An error occurred. Please try again')
      })
    })

    describe('Edge cases', () => {
      it('should handle null error', () => {
        const message = getUserMessage(null, 500)
        expect(message).toBe('Something went wrong. Please try again later')
      })

      it('should handle undefined error', () => {
        const message = getUserMessage(undefined, 400)
        expect(message).toBe('An error occurred. Please try again')
      })

      it('should handle error without errorCode property', () => {
        const error = { message: 'Some error' }
        const message = getUserMessage(error, 400)
        expect(message).toBe('An error occurred. Please try again')
      })

      it('should handle empty error object', () => {
        const error = {}
        const message = getUserMessage(error, 400)
        expect(message).toBe('An error occurred. Please try again')
      })

      it('should handle string error', () => {
        const error = 'Something went wrong'
        const message = getUserMessage(error, 500)
        expect(message).toBe('Something went wrong. Please try again later')
      })
    })

    describe('All error codes coverage', () => {
      it('should return a message for every error code in ErrorCodeEnum', () => {
        Object.values(ErrorCodeEnum).forEach((errorCode) => {
          const error = { errorCode }
          const message = getUserMessage(error, 400)
          expect(message).toBeTruthy()
          expect(message.length).toBeGreaterThan(0)
          expect(message).not.toBe('An error occurred. Please try again')
        })
      })
    })
  })
})

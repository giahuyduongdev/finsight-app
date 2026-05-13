const httpConfig = () => ({
  // Success responses
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection responses
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client error responses
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  REQUEST_TOO_LONG: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server error responses
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
})

const reasonPhrases = () =>
  ({
    // Success responses
    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.1
     * The request has succeeded.
     */
    OK: 'OK',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.2
     * The request has been fulfilled and resulted in a new resource being created.
     */
    CREATED: 'Created',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.3
     * The request has been accepted for processing, but the processing has not been completed.
     */
    ACCEPTED: 'Accepted',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.5
     * The server successfully processed the request and is not returning any content.
     */
    NO_CONTENT: 'No Content',

    // Redirection responses
    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.2
     * The resource has been permanently moved to a new URI.
     */
    MOVED_PERMANENTLY: 'Moved Permanently',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.3
     * The resource has been temporarily moved to a different URI.
     */
    FOUND: 'Found',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.4
     * The resource has not been modified since the last request.
     */
    NOT_MODIFIED: 'Not Modified',

    // Client error responses
    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.1
     * The server cannot process the request due to malformed request syntax.
     */
    BAD_REQUEST: 'Bad Request',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.2
     * Authentication is required and has failed or has not been provided.
     */
    UNAUTHORIZED: 'Unauthorized',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.3
     * The server refuses to authorize the request.
     */
    FORBIDDEN: 'Forbidden',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.4
     * The requested resource could not be found.
     */
    NOT_FOUND: 'Not Found',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.5
     * The HTTP method is not supported for the requested resource.
     */
    METHOD_NOT_ALLOWED: 'Method Not Allowed',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.7
     * The server timed out waiting for the request.
     */
    REQUEST_TIMEOUT: 'Request Timeout',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.8
     * The request conflicts with the current state of the server.
     */
    CONFLICT: 'Conflict',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.11
     * The request entity is larger than limits defined by the server.
     */
    REQUEST_TOO_LONG: 'Payload Too Large',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.13
     * The media type of the request is not supported by the server.
     */
    UNSUPPORTED_MEDIA_TYPE: 'Unsupported Media Type',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc4918#section-11.2
     * The request was well-formed but contains semantic errors.
     */
    UNPROCESSABLE_ENTITY: 'Unprocessable Entity',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc6585#section-4
     * The user has sent too many requests in a given amount of time.
     */
    TOO_MANY_REQUESTS: 'Too Many Requests',

    // Server error responses
    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.1
     * The server encountered an unexpected condition that prevented it from fulfilling the request.
     */
    INTERNAL_SERVER_ERROR: 'Internal Server Error',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.2
     * The server does not support the functionality required to fulfill the request.
     */
    NOT_IMPLEMENTED: 'Not Implemented',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.3
     * The server received an invalid response from an upstream server.
     */
    BAD_GATEWAY: 'Bad Gateway',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.4
     * The server is currently unable to handle the request due to temporary overload or maintenance.
     */
    SERVICE_UNAVAILABLE: 'Service Unavailable',

    /**
     * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.5
     * The server did not receive a timely response from an upstream server.
     */
    GATEWAY_TIMEOUT: 'Gateway Timeout'
  }) as const

export const HTTPSTATUS = httpConfig()
export const REASON_PHRASES = reasonPhrases()

export type HttpStatusCodeType = (typeof HTTPSTATUS)[keyof typeof HTTPSTATUS]
export type ReasonPhraseType =
  (typeof REASON_PHRASES)[keyof typeof REASON_PHRASES]

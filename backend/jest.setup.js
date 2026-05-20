// Jest setup file - runs before all tests

// Mock environment variables for testing
process.env.NODE_ENV = 'test'
process.env.MONGO_URI = 'mongodb://localhost:27017/test'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'
process.env.REDIS_URL = 'redis://localhost:6379'

// JWT Configuration
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing'
process.env.JWT_EXPIRES_IN = '15m'
process.env.JWT_REFRESH_EXPIRES_IN = '7d'

// Encryption
process.env.ENCRYPTION_SECRET = 'test-encryption-secret-key-for-testing'

// Google AI (Gemini)
process.env.GEMINI_API_KEY = 'test-gemini-api-key-for-testing'

// Cloudinary
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud-name'
process.env.CLOUDINARY_API_KEY = 'test-api-key'
process.env.CLOUDINARY_API_SECRET = 'test-api-secret'

// Resend
process.env.RESEND_API_KEY = 'test-resend-api-key'
process.env.SENTRY_DSN = ''

// Auth0
process.env.AUTH0_DOMAIN = 'test.auth0.com'
process.env.AUTH0_CLIENT_ID = 'test-client-id'
process.env.AUTH0_CLIENT_SECRET = 'test-client-secret'
process.env.AUTH0_CALLBACK_URL = 'http://localhost:8000/api/v1/auth/callback'

// Upstash Redis
process.env.UPSTASH_REDIS_URL = 'redis://localhost:6379'

// Other required env vars
process.env.PORT = '8000'
process.env.BASE_PATH = '/api'
process.env.FRONTEND_ORIGIN = 'http://localhost:3000'

// Mock Redis config to prevent connection and rate limiting issues
jest.mock('./src/config/redis.config', () => {
  // Create no-op middleware for rate limiters
  const noopMiddleware = (req, res, next) => next()

  return {
    redis: {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
      call: jest.fn()
    },
    rateLimiter: noopMiddleware,
    authRateLimiter: noopMiddleware,
    apiRateLimiter: noopMiddleware
  }
})

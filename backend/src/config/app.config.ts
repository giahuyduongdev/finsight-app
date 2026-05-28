/**
 * Application Configuration
 * App-level settings: port, CORS, base path, security, timeouts, features
 */

import { Env } from './env.config'

/**
 * Helper functions
 */
export const isDevelopment = () => Env.NODE_ENV === 'development'
export const isProduction = () => Env.NODE_ENV === 'production'
export const isTest = () => Env.NODE_ENV === 'test'

/**
 * Application configuration
 */
export const appConfig = {
  /**
   * Server port
   */
  port: Number(Env.PORT) || 8000,

  /**
   * API base path
   */
  basePath: Env.BASE_PATH || '/api',

  /**
   * Node environment
   */
  nodeEnv: Env.NODE_ENV || 'development',

  /**
   * CORS configuration
   */
  cors: {
    origin: Env.FRONTEND_ORIGIN || 'http://localhost:3000',
    credentials: true
  },

  /**
   * Trust proxy setting (for rate limiting, IP detection)
   */
  trustProxy: 1,

  /**
   * Request body & file size limits
   */
  limits: {
    bodySize: '50mb',
    fileUpload: '10mb'
  },

  /**
   * Security settings
   */
  security: {
    helmet: {
      contentSecurityPolicy: isProduction(),
      crossOriginEmbedderPolicy: isProduction()
    },
    cookie: {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax' as const
    }
  },

  /**
   * Timeouts (in milliseconds)
   */
  timeouts: {
    shutdown: 10_000, // 10 seconds
    request: 30_000 // 30 seconds
  },

  /**
   * Feature flags
   */
  features: {
    bullBoard: isDevelopment(),
    swagger: isDevelopment(),
    debug: isDevelopment(),
    compression: true
  },

  /**
   * Logging configuration
   */
  logging: {
    level: isProduction() ? 'info' : 'debug',
    style: isProduction() ? 'json' : 'pretty'
  }
} as const

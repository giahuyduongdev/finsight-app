import { getIO } from '../config/socket.config'
import { logger } from '../config/logger.config'

export type AuthSessionRevokedReason =
  'logout-all' | 'password-changed' | 'email-changed' | 'password-reset'

export interface AuthSessionRevokedPayload {
  userId: string
  reason: AuthSessionRevokedReason
  scope: 'all-sessions'
  redirectTo: '/'
  message: string
  source: 'api'
  revokedAt?: string
}

const SESSION_REVOKED_MESSAGES: Record<AuthSessionRevokedReason, string> = {
  'logout-all': 'Your sessions were ended. Please sign in again',
  'password-changed': 'Your password changed. Please sign in again',
  'email-changed': 'Your email changed. Please sign in again',
  'password-reset': 'Your password was reset. Please sign in again'
}

export const createAuthSessionRevokedPayload = (
  userId: string,
  reason: AuthSessionRevokedReason
): AuthSessionRevokedPayload => ({
  userId,
  reason,
  scope: 'all-sessions',
  redirectTo: '/',
  message: SESSION_REVOKED_MESSAGES[reason],
  source: 'api',
  revokedAt: new Date().toISOString()
})

export const emitAuthSessionRevoked = (
  userId: string,
  reason: AuthSessionRevokedReason
): void => {
  const payload = createAuthSessionRevokedPayload(userId, reason)

  try {
    getIO().to(userId).emit('auth:session-revoked', payload)
  } catch (error) {
    logger.warn('[APP:Auth] Failed to emit auth session revoked socket event', {
      userId,
      reason,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

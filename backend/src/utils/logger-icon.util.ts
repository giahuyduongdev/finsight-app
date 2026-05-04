import { Env } from '../config/env.config'

/**
 * Helper function to add icons to log messages only in development
 * In production, returns the message without icons for better log parsing
 */
export const logIcon = (icon: string, message: string): string => {
  return Env.NODE_ENV === 'development' ? `${icon} ${message}` : message
}

/**
 * Common log icons
 */
export const LOG_ICONS = {
  SERVER: '🖥️',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  MONITOR: '⚙️',
  SCHEDULE: '🗓️',
  EMAIL: '📧',
  STOP: '🛑',
  GOODBYE: '👋',
  TARGET: '🎯',
  WORKER: '⚙️',
  CACHE: '💾',
  CURRENCY: '💱',
  DB: '🗄️',
  QUEUE: '📋',
  SOCKET: '🔌',
  REFRESH: '🔄',
  DELETE: '🗑️',
  TIME: '⏱️',
  GLOBE: '🌐'
} as const

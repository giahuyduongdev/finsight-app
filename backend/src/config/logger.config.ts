import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { Env } from './env.config'
import { getRequestContext } from '../utils/asyncContext'
import { redactSensitiveFields } from '../utils/redact.util'

// ─── Custom Levels ────────────────────────────────────────────────────────────

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
}

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
}

winston.addColors(colors)

// ─── Formats ──────────────────────────────────────────────────────────────────

// Enhanced format: Inject request context from AsyncLocalStorage
const enhancedFormat = winston.format((info) => {
  const context = getRequestContext()

  return {
    ...info,
    ...(context.correlationId && { correlationId: context.correlationId }),
    ...(context.userId && { userId: context.userId }),
    ...(context.method && { method: context.method }),
    ...(context.path && { path: context.path })
  }
})

// Redacted format: Remove sensitive fields from logs
const redactedFormat = winston.format((info) => {
  if (info.body) {
    info.body = redactSensitiveFields(info.body)
  }
  if (info.meta) {
    info.meta = redactSensitiveFields(info.meta)
  }
  return info
})

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  enhancedFormat(),
  redactedFormat(),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    ({ timestamp, level, message, ...meta }) =>
      `[${timestamp}] ${level}: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`
  )
)

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  enhancedFormat(),
  redactedFormat(),
  winston.format.json()
)

// ─── Transports ───────────────────────────────────────────────────────────────

const transports: winston.transport[] = [
  // Console — luôn bật
  new winston.transports.Console(),

  // Error log — lưu file, rotate mỗi ngày
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d', // giữ 30 ngày
    zippedArchive: true
  }),

  // Combined log — tất cả level
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // giữ 14 ngày
    zippedArchive: true
  })
]

// ─── Logger ───────────────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  level: Env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format: Env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports,
  exitOnError: false
})

import 'dotenv/config'
import './config/passport.config'
import './config/redis.config'
import passport from 'passport'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { appConfig } from './config/app.config'
import { errorHandler } from './middlewares/errorHandler.middleware'
import { passportAuthenticateJwt } from './config/passport.config'
import { checkBlacklist } from './middlewares/blacklist.middleware'
import authRoutes from './routes/auth.route'
import userRoutes from './routes/user.route'
import transactionRoutes from './routes/transaction.route'
import reportRoutes from './routes/report.route'
import analyticsRoutes from './routes/analytics.route'
import helmet from 'helmet'
import compression from 'compression'
import { rateLimiter } from './config/redis.config'
import { successLogger, errorLogger } from './middlewares/morgan.middleware'
import { setupBullBoard } from './config/bull/bull-board.config'
import { logger } from './config/logger.config'
import { correlationIdMiddleware } from './middlewares/correlationId.middleware'
import { requestContextMiddleware } from './middlewares/requestContext.middleware'

const app = express()

// Request context must be set before logging
app.use(correlationIdMiddleware)
app.use(requestContextMiddleware)

// Logging middlewares (after request context is available)
app.use(successLogger)
app.use(errorLogger)

app.use(helmet())
app.use(compression())

app.use(express.json({ limit: appConfig.limits.bodySize }))
app.use(
  express.urlencoded({ limit: appConfig.limits.bodySize, extended: true })
)
app.use(cookieParser())
app.use(passport.initialize())
app.use(checkBlacklist)
app.use(cors(appConfig.cors))

app.set('trust proxy', appConfig.trustProxy)
app.use(rateLimiter)

if (appConfig.features.bullBoard) {
  // Bull Board - Protected in production, open in development
  const bullBoardMiddlewares =
    appConfig.nodeEnv === 'development' ? [] : [passportAuthenticateJwt]
  app.use('/admin/queues', ...bullBoardMiddlewares, setupBullBoard())
  logger.info(
    `[SYS:BullMQ] Bull Board: http://localhost:${appConfig.port}/admin/queues`
  )
}

app.use(`${appConfig.basePath}/auth`, authRoutes)
app.use(`${appConfig.basePath}/user`, passportAuthenticateJwt, userRoutes)
app.use(
  `${appConfig.basePath}/transaction`,
  passportAuthenticateJwt,
  transactionRoutes
)
app.use(`${appConfig.basePath}/report`, passportAuthenticateJwt, reportRoutes)
app.use(
  `${appConfig.basePath}/analytics`,
  passportAuthenticateJwt,
  analyticsRoutes
)

app.use(errorHandler)

export default app

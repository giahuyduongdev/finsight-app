import 'dotenv/config'
import './config/passport.config'
import './config/redis.config'
import passport from 'passport'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import fs from 'fs'
import path from 'path'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yaml'
import { appConfig } from './config/app.config'
import { errorHandler } from './middlewares/errorHandler.middleware'
import { passportAuthenticateJwt } from './config/passport.config'
import { checkBlacklist } from './middlewares/blacklist.middleware'
import helmet from 'helmet'
import compression from 'compression'
import { rateLimiter } from './config/redis.config'
import { successLogger, errorLogger } from './middlewares/morgan.middleware'
import { setupBullBoard } from './config/bull/bull-board.config'
import { logger } from './config/logger.config'
import { correlationIdMiddleware } from './middlewares/correlationId.middleware'
import { requestContextMiddleware } from './middlewares/requestContext.middleware'
import { initSentry } from './config/sentry.config'
import {
  healthCheckController,
  readinessCheckController
} from './controllers/health.controller'
import { rateLimitHeadersMiddleware } from './middlewares/rateLimitHeaders.middleware'
import routes from './routes'

const app = express()
const openApiPath = path.resolve(process.cwd(), 'docs/openapi.yaml')

initSentry(app)

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

app.get('/health', healthCheckController)
app.get('/ready', readinessCheckController)

if (appConfig.nodeEnv === 'development') {
  app.get('/debug-sentry', () => {
    throw new Error('Sentry test error')
  })
}

if (appConfig.features.swagger) {
  const docsPath = `${appConfig.basePath}/docs`
  const openApiUrl = `${docsPath}/openapi.yaml`
  const openApiDocument = YAML.parse(fs.readFileSync(openApiPath, 'utf8'))

  app.get(openApiUrl, (_req, res) => {
    res.type('yaml').sendFile(openApiPath)
  })

  app.use(docsPath, swaggerUi.serve, swaggerUi.setup(openApiDocument))

  logger.info(
    `[SYS:Docs] Swagger UI: http://localhost:${appConfig.port}${docsPath}`
  )
}

app.use(rateLimiter)
app.use(rateLimitHeadersMiddleware)

if (appConfig.features.bullBoard) {
  // Bull Board - Protected in production, open in development
  const bullBoardMiddlewares =
    appConfig.nodeEnv === 'development' ? [] : [passportAuthenticateJwt]
  app.use('/admin/queues', ...bullBoardMiddlewares, setupBullBoard())
  logger.info(
    `[SYS:BullMQ] Bull Board: http://localhost:${appConfig.port}/admin/queues`
  )
}

app.use(appConfig.basePath, routes)

app.use(errorHandler)

export default app

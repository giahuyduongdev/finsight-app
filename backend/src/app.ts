import 'dotenv/config'
import './config/passport.config'
import './config/redis.config'
import passport from 'passport'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { Env } from './config/env.config'
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
import { morganMiddleware } from './middlewares/morgan.middleware'
import { setupBullBoard } from './config/bull/bull-board.config'
import { logger } from './config/logger.config'

const app = express()
const BASE_PATH = Env.BASE_PATH

// app.use(morgan('dev'))
app.use(morganMiddleware)
app.use(helmet())
app.use(compression())

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(cookieParser())
app.use(passport.initialize())
app.use(checkBlacklist)
app.use(
  cors({
    origin: Env.FRONTEND_ORIGIN,
    credentials: true
  })
)

app.set('trust proxy', 1)
app.use(rateLimiter)

if (Env.NODE_ENV === 'development') {
  app.use('/admin/queues', setupBullBoard())
  logger.info(`🎯 Bull Board: http://localhost:${Env.PORT}/admin/queues`)
}

app.use(`${BASE_PATH}/auth`, authRoutes)
app.use(`${BASE_PATH}/user`, passportAuthenticateJwt, userRoutes)
app.use(`${BASE_PATH}/transaction`, passportAuthenticateJwt, transactionRoutes)
app.use(`${BASE_PATH}/report`, passportAuthenticateJwt, reportRoutes)
app.use(`${BASE_PATH}/analytics`, passportAuthenticateJwt, analyticsRoutes)

app.use(errorHandler)

export default app

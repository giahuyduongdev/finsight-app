import 'dotenv/config'
import './config/passport.config'
import './config/redis.config'
import passport from 'passport'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { Env } from './config/env.config'
import { HTTPSTATUS } from './config/http.config'
import { errorHandler } from './middlewares/errorHandler.middleware'
import { BadRequestException } from './utils/app-error'
import { asyncHandler } from './middlewares/asyncHandler.middleware'
import { passportAuthenticateJwt } from './config/passport.config'
import { checkBlacklist } from './middlewares/blacklist.middleware'
import authRoutes from './routes/auth.route'
import userRoutes from './routes/user.route'
import transactionRoutes from './routes/transaction.route'
import reportRoutes from './routes/report.route'
import analyticsRoutes from './routes/analytics.route'
import morgan from 'morgan'
import helmet from 'helmet'
import compression from 'compression'
import { rateLimiter, authRateLimiter } from './config/redis.config'

const app = express()
const BASE_PATH = Env.BASE_PATH

app.use(morgan('dev'))
app.use(helmet())
app.use(compression())

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(passport.initialize())
app.use(checkBlacklist)
app.use(
  cors({
    origin: Env.FRONTEND_ORIGIN,
    credentials: true
  })
)
app.use(rateLimiter)

app.use(`${BASE_PATH}/auth`, authRateLimiter, authRoutes)
app.use(`${BASE_PATH}/user`, passportAuthenticateJwt, userRoutes)
app.use(`${BASE_PATH}/transaction`, passportAuthenticateJwt, transactionRoutes)
app.use(`${BASE_PATH}/report`, passportAuthenticateJwt, reportRoutes)
app.use(`${BASE_PATH}/analytics`, passportAuthenticateJwt, analyticsRoutes)

app.use(errorHandler)

export default app

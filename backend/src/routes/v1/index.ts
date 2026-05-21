import { Router } from 'express'
import { passportAuthenticateJwt } from '../../config/passport.config'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import transactionRoutes from './transaction.routes'
import reportRoutes from './report.routes'
import analyticsRoutes from './analytics.routes'

const v1Routes = Router()

v1Routes.use('/auth', authRoutes)
v1Routes.use('/users', passportAuthenticateJwt, userRoutes)
v1Routes.use('/transactions', passportAuthenticateJwt, transactionRoutes)
v1Routes.use('/reports', passportAuthenticateJwt, reportRoutes)
v1Routes.use('/analytics', passportAuthenticateJwt, analyticsRoutes)

export default v1Routes

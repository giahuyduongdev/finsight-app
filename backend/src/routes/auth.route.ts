import { Router } from 'express'
import {
  loginController,
  registerController,
  refreshTokenController,
  logoutController,
  logoutAllController
} from '../controllers/auth.controller'
import { passportAuthenticateJwt } from '../config/passport.config'

const authRoutes = Router()

authRoutes.post('/register', registerController)
authRoutes.post('/login', loginController)
authRoutes.post('/refresh-token', refreshTokenController)
authRoutes.post('/logout', logoutController)
authRoutes.post('/logout-all', passportAuthenticateJwt, logoutAllController)

export default authRoutes

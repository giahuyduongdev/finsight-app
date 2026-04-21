import { Router } from 'express'
import {
  loginController,
  registerController,
  refreshTokenController,
  logoutController,
  logoutAllController,
  oauthRedirectController,
  oauthCallbackController,
  registerOTPController,
  verifyRegisterOTPController,
  resendRegisterOTPController,
  forgotPasswordController,
  verifyForgotPasswordOTPController,
  resetPasswordController,
  resendForgotPasswordOTPController,
  changePasswordRequestController,
  verifyChangePasswordOTPController,
  resendChangePasswordOTPController,
  changeEmailRequestController,
  verifyChangeEmailOTPController,
  resendChangeEmailOTPController
} from '../controllers/auth.controller'
import { passportAuthenticateJwt } from '../config/passport.config'
import { authRateLimiter } from '../config/redis.config'

const authRoutes = Router()

authRoutes.post('/login', authRateLimiter, loginController)

// authRoutes.post('/register', registerController)
authRoutes.post('/register', authRateLimiter, registerOTPController)
authRoutes.post(
  '/register/verify-otp',
  authRateLimiter,
  verifyRegisterOTPController
)
authRoutes.post(
  '/register/resend',
  authRateLimiter,
  resendRegisterOTPController
)

authRoutes.post('/password/forgot', authRateLimiter, forgotPasswordController)
authRoutes.post(
  '/password/verify-otp',
  authRateLimiter,
  verifyForgotPasswordOTPController
)
authRoutes.post(
  '/password/resend',
  authRateLimiter,
  resendForgotPasswordOTPController
)
authRoutes.post('/password/reset', authRateLimiter, resetPasswordController)
authRoutes.post(
  '/password/change-request',
  passportAuthenticateJwt,
  authRateLimiter,
  changePasswordRequestController
)
authRoutes.post(
  '/password/change-verify',
  passportAuthenticateJwt,
  authRateLimiter,
  verifyChangePasswordOTPController
)
authRoutes.post(
  '/password/change-resend',
  passportAuthenticateJwt,
  authRateLimiter,
  resendChangePasswordOTPController
)
authRoutes.post(
  '/email/change-request',
  passportAuthenticateJwt,
  authRateLimiter,
  changeEmailRequestController
)
authRoutes.post(
  '/email/change-verify',
  passportAuthenticateJwt,
  authRateLimiter,
  verifyChangeEmailOTPController
)
authRoutes.post(
  '/email/change-resend',
  passportAuthenticateJwt,
  authRateLimiter,
  resendChangeEmailOTPController
)

authRoutes.post('/refresh-token', refreshTokenController)
authRoutes.post('/logout', logoutController)
authRoutes.post('/logout-all', passportAuthenticateJwt, logoutAllController)

// Redirect sang Auth0
authRoutes.get('/oauth/:provider', authRateLimiter, oauthRedirectController)
//Auth0 callback về đây
authRoutes.get('/callback', authRateLimiter, oauthCallbackController)

export default authRoutes

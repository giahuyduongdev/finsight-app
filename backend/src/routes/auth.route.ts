import { Router } from 'express'
import {
  loginController,
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
import { validate } from '../middlewares/validate.middleware'
import {
  registerSchema,
  loginSchema,
  verifyOTPSchema,
  resendOTPSchema,
  forgotPasswordSchema,
  verifyForgotOTPSchema,
  resetPasswordSchema,
  changePasswordRequestSchema,
  verifyChangePasswordOTPSchema,
  changeEmailRequestSchema,
  verifyChangeEmailOTPSchema,
  refreshTokenSchema
} from '../validators/auth.validator'

const authRoutes = Router()

authRoutes.post(
  '/login',
  authRateLimiter,
  validate(loginSchema, 'body'),
  loginController
)

// authRoutes.post('/register', registerController)
authRoutes.post(
  '/register',
  authRateLimiter,
  validate(registerSchema, 'body'),
  registerOTPController
)
authRoutes.post(
  '/register/verify-otp',
  authRateLimiter,
  validate(verifyOTPSchema, 'body'),
  verifyRegisterOTPController
)
authRoutes.post(
  '/register/resend',
  authRateLimiter,
  validate(resendOTPSchema, 'body'),
  resendRegisterOTPController
)

authRoutes.post(
  '/password/forgot',
  authRateLimiter,
  validate(forgotPasswordSchema, 'body'),
  forgotPasswordController
)
authRoutes.post(
  '/password/verify-otp',
  authRateLimiter,
  validate(verifyForgotOTPSchema, 'body'),
  verifyForgotPasswordOTPController
)
authRoutes.post(
  '/password/resend',
  authRateLimiter,
  validate(resendOTPSchema, 'body'),
  resendForgotPasswordOTPController
)
authRoutes.post(
  '/password/reset',
  authRateLimiter,
  validate(resetPasswordSchema, 'body'),
  resetPasswordController
)
authRoutes.post(
  '/password/change-request',
  passportAuthenticateJwt,
  authRateLimiter,
  validate(changePasswordRequestSchema, 'body'),
  changePasswordRequestController
)
authRoutes.post(
  '/password/change-verify',
  passportAuthenticateJwt,
  authRateLimiter,
  validate(verifyChangePasswordOTPSchema, 'body'),
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
  validate(changeEmailRequestSchema, 'body'),
  changeEmailRequestController
)
authRoutes.post(
  '/email/change-verify',
  passportAuthenticateJwt,
  authRateLimiter,
  validate(verifyChangeEmailOTPSchema, 'body'),
  verifyChangeEmailOTPController
)
authRoutes.post(
  '/email/change-resend',
  passportAuthenticateJwt,
  authRateLimiter,
  resendChangeEmailOTPController
)

authRoutes.post(
  '/refresh-token',
  validate(refreshTokenSchema, 'body'),
  refreshTokenController
)
authRoutes.post('/logout', logoutController)
authRoutes.post('/logout-all', passportAuthenticateJwt, logoutAllController)

// Redirect sang Auth0
authRoutes.get('/oauth/:provider', authRateLimiter, oauthRedirectController)
//Auth0 callback về đây
authRoutes.get('/callback', authRateLimiter, oauthCallbackController)

export default authRoutes

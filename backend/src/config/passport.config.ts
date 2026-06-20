import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions
} from 'passport-jwt'
import passport from 'passport'
import { Env } from '../config/env.config'
import { authenticateAccessToken } from '../services/access-token-auth.service'

interface JwtPayload {
  userId?: string
  tokenVersion?: number
}

const options: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: Env.JWT_SECRET,
  audience: ['user'],
  algorithms: ['HS256'],
  issuer: Env.JWT_ISSUER
}

passport.use(
  new JwtStrategy(options, async (payload: JwtPayload, done) => {
    try {
      const user = await authenticateAccessToken(payload)
      if (!user) {
        return done(null, false, { message: 'Invalid or revoked token' })
      }

      return done(null, user)
    } catch (error) {
      return done(error, false)
    }
  })
)

passport.serializeUser((user: Express.User, done) => done(null, user))
passport.deserializeUser((user: Express.User, done) => done(null, user))

export const passportAuthenticateJwt = passport.authenticate('jwt', {
  session: false
})

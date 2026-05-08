import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions
} from 'passport-jwt'
import passport from 'passport'
import { Env } from '../config/env.config'
import { container } from '../container'
import { redis } from '../config/redis.config'

interface JwtPayload {
  userId: string
}

const options: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: Env.JWT_SECRET,
  audience: ['user'],
  algorithms: ['HS256']
}

passport.use(
  new JwtStrategy(options, async (payload: JwtPayload, done) => {
    try {
      if (!payload.userId) {
        return done(null, false, { message: 'Invalid token payload' })
      }

      // Check Redis cache trước
      const cached = await redis.get(`user:${payload.userId}`)
      if (cached) {
        return done(null, JSON.parse(cached))
      }

      // Get UserService from DI container
      const userService = container.getUserService()
      const user = await userService.findById(payload.userId)
      if (!user) {
        return done(null, false)
      }

      // Lưu Redis TTL = 15 phút (bằng accessToken)
      await redis.set(`user:${payload.userId}`, JSON.stringify(user), 'EX', 900)

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

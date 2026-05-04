import { UserDocument } from '../models/user.model'
import { Types } from 'mongoose'

declare global {
  namespace Express {
    interface User extends UserDocument {
      _id?: Types.ObjectId
      timezone?: string
      preferredCurrency?: string
      role?: string
    }

    interface Request {
      correlationId?: string
      user?: User
    }
  }
}

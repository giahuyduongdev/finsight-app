import mongoose, { Document, Schema } from 'mongoose'
import { compareValue, hashValue } from '../utils/bcrypt.util'
import { CurrencyEnum } from '../enums/currency.enum'
import { RoleUserEnum } from '../enums/role-user.enum'

export interface UserDocument extends Document {
  name: string
  email: string
  password: string
  profilePicture: string | null
  timezone: string
  preferredCurrency: string
  role: string
  auth0Ids?: string[]
  createdAt: Date
  updatedAt: Date
  comparePassword: (password: string) => Promise<boolean>
  omitPassword: () => Omit<UserDocument, 'password'>
}

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    profilePicture: {
      type: String,
      default: null
    },
    password: {
      type: String,
      select: true,
      required: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    preferredCurrency: {
      type: String,
      enum: Object.values(CurrencyEnum),
      default: CurrencyEnum.USD
    },
    role: {
      type: String,
      enum: Object.values(RoleUserEnum),
      default: RoleUserEnum.USER
    },
    auth0Ids: {
      type: [String],
      default: undefined, // Mặc định là mảng rỗng cho user mới
      index: {
        unique: true,
        sparse: true
      }
    }
  },
  {
    timestamps: true
  }
)

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    if (this.password) {
      this.password = await hashValue(this.password)
    }
  }
  next()
})

userSchema.methods.omitPassword = function (): Omit<UserDocument, 'password'> {
  const userObject = this.toObject()
  delete userObject.password
  return userObject
}

userSchema.methods.comparePassword = async function (password: string) {
  return compareValue(password, this.password)
}

const UserModel = mongoose.model<UserDocument>('User', userSchema)
export default UserModel

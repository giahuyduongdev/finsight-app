import { Router } from 'express'
import {
  changeUserPasswordController,
  getCurrentUserController,
  updateUserController
} from '../controllers/user.controller'
import { upload } from '../config/cloudinary.config'
import { validate } from '../middlewares/validate.middleware'
import {
  updateUserSchema,
  changePasswordSchema
} from '../validators/user.validator'

const userRoutes = Router()

userRoutes.get('/current-user', getCurrentUserController)
userRoutes.put(
  '/update-user',
  validate(updateUserSchema, 'body'),
  upload.single('profilePicture'),
  updateUserController
)
userRoutes.put(
  '/change-password',
  validate(changePasswordSchema, 'body'),
  changeUserPasswordController
)

export default userRoutes

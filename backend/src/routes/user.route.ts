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
  upload.single('profilePicture'),
  validate(updateUserSchema, 'body'),
  updateUserController
)
userRoutes.put(
  '/change-password',
  validate(changePasswordSchema, 'body'),
  changeUserPasswordController
)

export default userRoutes

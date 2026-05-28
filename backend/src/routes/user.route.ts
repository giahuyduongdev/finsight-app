import { Router } from 'express'
import {
  getCurrentUserController,
  updateUserController
} from '../controllers/user.controller'
import { upload } from '../config/cloudinary.config'

const userRoutes = Router()

userRoutes.get('/current-user', getCurrentUserController)
userRoutes.put(
  '/update-user',
  upload.single('profilePicture'),
  updateUserController
)

export default userRoutes

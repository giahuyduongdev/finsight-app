import { Router } from 'express'
import {
  changeUserPasswordController,
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
userRoutes.put(
  '/change-password', // ← verify accessToken, gắn req.user vào
  changeUserPasswordController
)

export default userRoutes

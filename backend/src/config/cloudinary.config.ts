import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { Env } from './env.config'
import multer from 'multer'
import { BadRequestException } from '../utils/errors/index'
import { ErrorCodeEnum } from '../enums/error-code.enum'

cloudinary.config({
  cloud_name: Env.CLOUDINARY_CLOUD_NAME,
  api_key: Env.CLOUDINARY_API_KEY,
  api_secret: Env.CLOUDINARY_API_SECRET,
  timeout: 10000
})

const STORAGE_PARAMS = {
  folder: 'images',
  allowed_formats: ['jpg', 'png', 'jpeg'],
  resource_type: 'image' as const,
  quality: 'auto:good' as const
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    ...STORAGE_PARAMS
  })
})

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_, file, cb) => {
    const isValid = /^image\/(jpe?g|png)$/.test(file.mimetype)
    if (!isValid) {
      return cb(
        new BadRequestException(
          'Only jpg, jpeg, png files are allowed',
          ErrorCodeEnum.FILE_UPLOAD_ERROR
        ) as any
      )
    }

    cb(null, true)
  }
})

// Used for routes that need to process files in memory before uploading (e.g. sharp compression)
export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB limit for raw uncompressed images
  fileFilter: (_, file, cb) => {
    const isValid = /^image\/(jpe?g|png)$/.test(file.mimetype)
    if (!isValid) {
      return cb(
        new BadRequestException(
          'Only jpg, jpeg, png files are allowed',
          ErrorCodeEnum.FILE_UPLOAD_ERROR
        ) as any
      )
    }

    cb(null, true)
  }
})

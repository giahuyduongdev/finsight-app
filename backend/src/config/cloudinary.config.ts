import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiResponse } from 'cloudinary'
import { Env } from './env.config'
import multer from 'multer'
import { BadRequestException } from '../utils/errors/index'
import { ErrorCodeEnum } from '../enums/error-code.enum'
import { cloudinaryCircuitBreaker } from '../utils/circuitBreaker.util'

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

const uploadFileToCloudinary = (
  file: Express.Multer.File
): Promise<Partial<Express.Multer.File>> =>
  new Promise((resolve, reject) => {
    let settled = false

    const finish = (
      error?: Error | null,
      info?: Partial<Express.Multer.File>
    ) => {
      if (settled) return
      settled = true

      if (error) {
        reject(error)
        return
      }

      resolve(info ?? {})
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      STORAGE_PARAMS,
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          finish(error || new Error('Cloudinary upload failed'))
          return
        }

        finish(null, {
          path: result.secure_url,
          filename: result.public_id,
          size: result.bytes
        })
      }
    )

    file.stream.once('error', (error) => {
      uploadStream.destroy(error)
      finish(error)
    })
    uploadStream.once('error', finish)

    file.stream.pipe(uploadStream)
  })

const storage: multer.StorageEngine = {
  _handleFile(_req, file, cb) {
    let callbackCalled = false

    const done = (
      error?: Error | null,
      info?: Partial<Express.Multer.File>
    ) => {
      if (callbackCalled) return
      callbackCalled = true
      cb(error, info)
    }

    cloudinaryCircuitBreaker
      .execute(() => uploadFileToCloudinary(file), 'Cloudinary Upload')
      .then((info) => done(null, info))
      .catch((error) => done(error as Error))
  },

  _removeFile(_req, file, cb) {
    if (!file.filename) {
      cb(null)
      return
    }

    cloudinaryCircuitBreaker
      .execute(
        () => cloudinary.uploader.destroy(file.filename as string),
        'Cloudinary Delete'
      )
      .then(() => cb(null))
      .catch((error) => cb(error as Error))
  }
}

const fileFilter: multer.Options['fileFilter'] = (_, file, cb) => {
  const isValid = /^image\/(jpe?g|png)$/.test(file.mimetype)
  if (!isValid) {
    const error = new BadRequestException(
      'Only jpg, jpeg, png files are allowed',
      ErrorCodeEnum.FILE_UPLOAD_ERROR
    )
    return cb(error as unknown as Error)
  }

  cb(null, true)
}

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter
})

// Used for routes that need to process files in memory before uploading (e.g. sharp compression)
export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB limit for raw uncompressed images
  fileFilter
})

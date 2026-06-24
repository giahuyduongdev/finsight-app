import { v2 as cloudinary } from 'cloudinary'
import { cloudinaryCircuitBreaker } from '../circuitBreaker.util'
import { observeProviderCall } from '../../observability'

export type ReceiptImageUploadResult = {
  secure_url: string
  public_id: string
}

type UploadReceiptImageOptions = {
  publicId?: string
}

const getExistingReceiptImage = async (
  publicId: string
): Promise<ReceiptImageUploadResult | null> => {
  try {
    const result = (await cloudinary.api.resource(publicId, {
      resource_type: 'image'
    })) as ReceiptImageUploadResult

    return {
      secure_url: result.secure_url,
      public_id: result.public_id
    }
  } catch (error) {
    const err = error as { error?: { http_code?: number }; http_code?: number }
    if (err.http_code === 404 || err.error?.http_code === 404) return null
    throw error
  }
}

const isExistingAssetError = (error: unknown) => {
  const err = error as { http_code?: number; message?: string }
  return (
    err.http_code === 409 ||
    err.message?.toLowerCase().includes('already exists')
  )
}

export const uploadReceiptImageToCloudinary = (
  buffer: Buffer,
  options: UploadReceiptImageOptions = {}
): Promise<ReceiptImageUploadResult> =>
  observeProviderCall(
    { provider: 'cloudinary', operation: 'receipt_upload' },
    () =>
      cloudinaryCircuitBreaker.execute(async () => {
        if (options.publicId) {
          const existingImage = await getExistingReceiptImage(options.publicId)
          if (existingImage) return existingImage
        }

        return await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: options.publicId ? undefined : 'receipts',
              public_id: options.publicId,
              overwrite: false,
              resource_type: 'image',
              timeout: 10000
            },
            async (error, result) => {
              if (error && options.publicId && isExistingAssetError(error)) {
                try {
                  const existingImage = await getExistingReceiptImage(
                    options.publicId
                  )
                  if (existingImage) {
                    resolve(existingImage)
                    return
                  }
                } catch (lookupError) {
                  reject(lookupError)
                  return
                }
              }

              if (error || !result) {
                reject(error || new Error('Upload failed'))
                return
              }

              resolve(result)
            }
          )

          uploadStream.end(buffer)
        })
      }, 'Cloudinary Receipt Upload')
  )

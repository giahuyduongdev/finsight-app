const mockResource = jest.fn()
const mockUploadStream = jest.fn()

jest.mock('cloudinary', () => ({
  v2: {
    api: {
      resource: (...args: unknown[]) => mockResource(...args)
    },
    uploader: {
      upload_stream: (...args: unknown[]) => mockUploadStream(...args)
    }
  }
}))

jest.mock('../../utils/circuitBreaker.util', () => ({
  cloudinaryCircuitBreaker: {
    execute: (operation: () => Promise<unknown>) => operation()
  }
}))

import { uploadReceiptImageToCloudinary } from '../../utils/receipt/upload.util'

describe('receipt-upload.util', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should reuse existing Cloudinary receipt image when public id already exists', async () => {
    mockResource.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/receipt.jpg',
      public_id: 'receipts/user-123/hash-123'
    })

    const result = await uploadReceiptImageToCloudinary(Buffer.from('image'), {
      publicId: 'receipts/user-123/hash-123'
    })

    expect(result).toEqual({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/receipt.jpg',
      public_id: 'receipts/user-123/hash-123'
    })
    expect(mockResource).toHaveBeenCalledWith('receipts/user-123/hash-123', {
      resource_type: 'image'
    })
    expect(mockUploadStream).not.toHaveBeenCalled()
  })

  it('should upload with deterministic public id and no overwrite when image does not exist', async () => {
    mockResource.mockRejectedValue({ error: { http_code: 404 } })
    mockUploadStream.mockImplementation((options, callback) => ({
      end: jest.fn(() =>
        callback(null, {
          secure_url: 'https://res.cloudinary.com/demo/image/upload/new.jpg',
          public_id: options.public_id
        })
      )
    }))

    const result = await uploadReceiptImageToCloudinary(Buffer.from('image'), {
      publicId: 'receipts/user-123/hash-123'
    })

    expect(result).toEqual({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/new.jpg',
      public_id: 'receipts/user-123/hash-123'
    })
    expect(mockUploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        public_id: 'receipts/user-123/hash-123',
        overwrite: false,
        resource_type: 'image'
      }),
      expect.any(Function)
    )
  })

  it('should reuse existing image when upload hits a duplicate public id race', async () => {
    mockResource
      .mockRejectedValueOnce({ http_code: 404 })
      .mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/race.jpg',
        public_id: 'receipts/user-123/hash-123'
      })
    mockUploadStream.mockImplementation((_options, callback) => ({
      end: jest.fn(() =>
        callback({
          http_code: 409,
          message: 'Asset already exists'
        })
      )
    }))

    const result = await uploadReceiptImageToCloudinary(Buffer.from('image'), {
      publicId: 'receipts/user-123/hash-123'
    })

    expect(result).toEqual({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/race.jpg',
      public_id: 'receipts/user-123/hash-123'
    })
    expect(mockResource).toHaveBeenCalledTimes(2)
  })
})

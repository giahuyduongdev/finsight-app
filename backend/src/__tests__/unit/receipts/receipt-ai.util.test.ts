const mockGenerateWithFallback = jest.fn()

jest.mock('../../../config/google-ai.config', () => ({
  generateWithFallback: (...args: unknown[]) =>
    mockGenerateWithFallback(...args)
}))

import {
  extractReceiptDataFromBase64,
  NonReceiptImageError
} from '../../../utils/receipt/ai.util'

describe('receipt ai util', () => {
  beforeEach(() => {
    mockGenerateWithFallback.mockReset()
  })

  it('should map invalid Gemini JSON to NonReceiptImageError', async () => {
    mockGenerateWithFallback.mockResolvedValue({
      text: 'not-json'
    })

    await expect(extractReceiptDataFromBase64('base64-image')).rejects.toThrow(
      NonReceiptImageError
    )
  })

  it('should parse valid Gemini receipt JSON', async () => {
    mockGenerateWithFallback.mockResolvedValue({
      text: JSON.stringify({
        title: 'Coffee',
        amount: '5',
        currency: 'USD',
        date: '2026-05-28',
        description: 'Morning coffee',
        category: 'Food',
        paymentMethod: 'CARD',
        type: 'EXPENSE',
        status: 'COMPLETED'
      })
    })

    await expect(
      extractReceiptDataFromBase64('base64-image', { maxElapsedMs: 60000 })
    ).resolves.toEqual({
      title: 'Coffee',
      amount: 5,
      currency: 'USD',
      date: '2026-05-28T00:00:00.000Z',
      description: 'Morning coffee',
      category: 'Food',
      paymentMethod: 'CARD',
      type: 'EXPENSE',
      status: 'COMPLETED'
    })
    expect(mockGenerateWithFallback).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ responseMimeType: 'application/json' }),
      { maxElapsedMs: 60000 }
    )
  })
})

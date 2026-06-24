import { generateWithFallback } from '../../config/google-ai.config'
import { receiptPrompt } from '../../lib/prompts/receipt.prompt'

export type ExtractedReceiptData = {
  title: string
  amount: number
  currency: string
  date: string
  description: string
  category: string
  paymentMethod: string
  type: 'INCOME' | 'EXPENSE'
  status: string
}

export class NonReceiptImageError extends Error {
  constructor(message = 'This image does not look like a receipt.') {
    super(message)
    this.name = 'NonReceiptImageError'
  }
}

const normalizeReceiptDate = (value: unknown) => {
  const dateText = String(value || '').trim()
  if (!dateText) {
    throw new NonReceiptImageError(
      'This image does not contain recognizable receipt date information.'
    )
  }

  const parsedDate = new Date(dateText)
  if (Number.isNaN(parsedDate.getTime())) {
    throw new NonReceiptImageError(
      'This image does not contain a valid receipt date.'
    )
  }

  return parsedDate.toISOString()
}

const parseGeminiResponse = (responseText: string): ExtractedReceiptData => {
  const cleanedText = responseText?.replace(/```(?:json)?\n?/g, '').trim()

  if (!cleanedText) {
    throw new NonReceiptImageError('Could not read receipt content')
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(cleanedText)
  } catch {
    throw new NonReceiptImageError('Could not read receipt content')
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).length === 0
  ) {
    throw new NonReceiptImageError('This image does not look like a receipt.')
  }

  const amount = Number(data.amount)
  if (isNaN(amount) || !data.date) {
    throw new NonReceiptImageError(
      'This image does not contain recognizable receipt amount or date information.'
    )
  }

  const allowedCurrencies = ['VND', 'USD', 'EUR']
  const allowedTypes = ['EXPENSE', 'INCOME']
  const allowedStatus = ['COMPLETED', 'PENDING']
  const currency = typeof data.currency === 'string' ? data.currency : 'VND'
  const type = typeof data.type === 'string' ? data.type : 'EXPENSE'
  const status = typeof data.status === 'string' ? data.status : 'COMPLETED'

  return {
    title: String(data.title || 'Receipt').substring(0, 100),
    amount,
    currency: allowedCurrencies.includes(currency) ? currency : 'VND',
    date: normalizeReceiptDate(data.date),
    description: String(data.description || '').substring(0, 2000),
    category: String(data.category || 'General').substring(0, 100),
    paymentMethod: String(data.paymentMethod || 'CASH').substring(0, 50),
    type: allowedTypes.includes(type)
      ? (type as 'EXPENSE' | 'INCOME')
      : 'EXPENSE',
    status: allowedStatus.includes(status) ? status : 'COMPLETED'
  }
}

export const extractReceiptDataFromBase64 = async (
  base64String: string,
  options: { maxElapsedMs?: number } = {}
): Promise<ExtractedReceiptData> => {
  const response = await generateWithFallback(
    [
      {
        role: 'user',
        parts: [
          { text: receiptPrompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64String
            }
          }
        ]
      }
    ],
    {
      temperature: 0,
      topP: 1,
      responseMimeType: 'application/json'
    },
    options
  )

  const responseText = response.text
  if (!responseText) {
    throw new NonReceiptImageError('Could not read receipt content from Gemini')
  }

  return parseGeminiResponse(responseText)
}

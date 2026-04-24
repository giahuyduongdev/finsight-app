export type ParsedTransaction = {
  title: string
  amount: number
  date: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  paymentMethod?: string
  status?: string
  currency?: string
  isRecurring: boolean
  description: string
}

export type ParsedRow = {
  id: string
  data: ParsedTransaction | null
  error?: string
  isValid: boolean
}

export type CsvRowWrapper = {
  id: string
  data: Record<string, string | undefined>
}

export type ConfirmationStepProps = {
  mappings: Record<string, string>
  csvData: Record<string, string | undefined>[]
  onComplete: () => void
  onBack: () => void
}

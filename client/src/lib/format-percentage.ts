const percentFormatters = {
  0: new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }),
  1: new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }),
  2: new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }),
  3: new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }),
  4: new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }),
  5: new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 5,
    maximumFractionDigits: 5
  }),
  6: new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  })
} as const

const formatPercentValue = (value: number, decimalPlaces: number) => {
  const formatter =
    percentFormatters[decimalPlaces as keyof typeof percentFormatters]

  if (formatter) return formatter.format(value)

  return value.toLocaleString('en-US', {
    style: 'percent',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  })
}

export const formatPercentage = (
  value: number,
  options: {
    decimalPlaces?: number
    showSign?: boolean
    isExpense?: boolean
  } = {}
): string => {
  const { decimalPlaces = 1, showSign = false, isExpense = false } = options

  if (typeof value !== 'number' || isNaN(value)) return '0%'

  const absValue = Math.abs(value)
  const formatted = formatPercentValue(absValue / 100, decimalPlaces)

  if (!showSign) return formatted
  // Special handling for expenses (opposite of normal)
  if (isExpense) {
    return value <= 0 ? `+${formatted}` : `-${formatted}`
  }

  // Normal handling for income/balance
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

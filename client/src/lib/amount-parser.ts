import { ZERO_DECIMAL_CURRENCIES } from './format-currency'

/**
 * Parses a string amount using heuristics to detect decimal and grouping separators.
 * Handles cases like "1,234.56", "1.234,56", "1234.56", "1,234" etc.
 */
export const parseAmount = (value: unknown, currency?: string): number => {
  const cleanValue = String(value || '').trim().replace(/[^\d.,-]/g, '')
  if (!cleanValue) return 0

  const lastPoint = cleanValue.lastIndexOf('.')
  const lastComma = cleanValue.lastIndexOf(',')

  // Final Number conversion with NaN guard
  const finalResult = (() => {
    if (lastPoint === -1 && lastComma === -1) {
      return Number(cleanValue)
    }

    const separator = lastPoint > lastComma ? '.' : ','
    const parts = cleanValue.split(separator)

    if (parts.length > 2) {
      return Number(cleanValue.replace(new RegExp(`\\${separator}`, 'g'), ''))
    } else if (parts.length === 2) {
      const integerPart = parts[0].replace(/[^\d-]/g, '')
      const decimalPart = parts[1].replace(/[^\d]/g, '')

      const isProbablyGrouping =
        decimalPart.length === 3 &&
        (ZERO_DECIMAL_CURRENCIES.includes(currency || 'USD') || separator === ',')

      if (isProbablyGrouping && !cleanValue.includes(separator === '.' ? ',' : '.')) {
        return Number(integerPart + decimalPart)
      } else {
        return Number(integerPart + '.' + (decimalPart || '0'))
      }
    } else {
      return Number(cleanValue.replace(/[,.]/g, '.'))
    }
  })()

  return isNaN(finalResult) ? 0 : finalResult
}

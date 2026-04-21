import { CURRENCY_SYMBOLS, CurrencyType } from '@/constant' // Nhớ check lại đường dẫn import nhé

// Danh sách các tiền tệ không dùng số thập phân
export const ZERO_DECIMAL_CURRENCIES = [
  'VND',
  'JPY',
  'KRW',
  'IDR',
  'CLP',
  'ISK'
]

export const formatCurrency = (
  value: number,
  options: {
    currency?: string
    decimalPlaces?: number
    compact?: boolean
    showSign?: boolean
    isExpense?: boolean
  } = {}
): string => {
  const {
    currency = 'USD',
    compact = false,
    showSign = false,
    isExpense = false
  } = options

  const decimalPlaces =
    options.decimalPlaces !== undefined
      ? options.decimalPlaces
      : ZERO_DECIMAL_CURRENCIES.includes(currency)
        ? 0
        : 2

  const displayValue = isExpense ? -Math.abs(value) : value

  // 1. Lấy Symbol từ cuốn "từ điển" của bạn
  const symbol = CURRENCY_SYMBOLS[currency as CurrencyType] || currency

  // 2. Chỉ nhờ Intl format con số nguyên thủy (decimal), KHÔNG dùng currency nữa
  const formattedNumber = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    notation: compact ? 'compact' : 'standard'
  }).format(Math.abs(displayValue))

  // 3. Tự xử lý dấu cho chuẩn UI
  const isNegative = displayValue < 0 || (value === 0 && isExpense)
  const sign = isNegative ? '-' : showSign && displayValue > 0 ? '+' : ''

  // 4. Lắp ráp thành phẩm: [Dấu] + [Icon] + [Khoảng trắng] + [Con số]
  return `${sign}${symbol} ${formattedNumber}`
}

/**
 * Format tỷ giá giữa 2 đồng tiền một cách thông minh.
 * - Zero-decimal currencies (VND, JPY, KRW...): làm tròn, thêm dấu phân cách hàng nghìn
 * - Tỷ giá >= 100: 2 chữ số thập phân
 * - Tỷ giá >= 1: 4 chữ số thập phân
 * - Tỷ giá < 1 (VD: USD/VND ngược): 6 chữ số thập phân
 */
export const formatRate = (rate: number, toCurrency: string): string => {
  if (ZERO_DECIMAL_CURRENCIES.includes(toCurrency)) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
      Math.round(rate)
    )
  }
  if (rate >= 100)
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rate)
  if (rate >= 1) return rate.toFixed(4)
  return rate.toFixed(6)
}

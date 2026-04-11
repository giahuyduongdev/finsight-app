import { CURRENCY_SYMBOLS, CurrencyType } from '@/constant' // Nhớ check lại đường dẫn import nhé

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

  // VND và JPY không dùng số thập phân
  const noDecimalCurrencies = ['VND', 'JPY']
  const decimalPlaces =
    options.decimalPlaces !== undefined
      ? options.decimalPlaces
      : noDecimalCurrencies.includes(currency)
        ? 0
        : 2

  const displayValue = isExpense ? -Math.abs(value) : value

  // 1. Lấy Symbol từ cuốn "từ điển" của bạn
  const symbol = CURRENCY_SYMBOLS[currency as CurrencyType] || currency

  // 2. Chỉ nhờ Intl format con số nguyên thủy (decimal), KHÔNG dùng currency nữa
  const formattedNumber = new Intl.NumberFormat('en-US', {
    style: 'decimal', // 👉 Đổi từ 'currency' sang 'decimal'
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    notation: compact ? 'compact' : 'standard'
  }).format(Math.abs(displayValue)) // Ép số tuyệt đối để ta tự gắn dấu '-'

  // 3. Tự xử lý dấu cho chuẩn UI
  const isNegative = displayValue < 0 || (value === 0 && isExpense)
  const sign = isNegative ? '-' : showSign && displayValue > 0 ? '+' : ''

  // 4. Lắp ráp thành phẩm: [Dấu] + [Icon] + [Khoảng trắng] + [Con số]
  return `${sign}${symbol} ${formattedNumber}`
}

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

export const DEFAULT_LOCALE = 'en-US'

const standardDecimalFormatters = {
  0: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }),
  1: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }),
  2: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }),
  3: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }),
  4: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }),
  5: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 5,
    maximumFractionDigits: 5
  }),
  6: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  })
} as const

const compactDecimalFormatters = {
  0: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: 'compact'
  }),
  1: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    notation: 'compact'
  }),
  2: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    notation: 'compact'
  }),
  3: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    notation: 'compact'
  }),
  4: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
    notation: 'compact'
  }),
  5: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
    notation: 'compact'
  }),
  6: new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
    notation: 'compact'
  })
} as const

const formatDecimal = (
  value: number,
  decimalPlaces: number,
  compact = false
) => {
  const key = decimalPlaces as keyof typeof standardDecimalFormatters
  const formatter = compact
    ? compactDecimalFormatters[key]
    : standardDecimalFormatters[key]

  if (formatter) return formatter.format(value)

  return value.toLocaleString(DEFAULT_LOCALE, {
    style: 'decimal',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    notation: compact ? 'compact' : 'standard'
  })
}

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

  // 2. Định dạng Locale (Dùng en-US cho tất cả để đồng bộ dấu phẩy ngăn hàng nghìn như Add Transaction)
  const formattedNumber = formatDecimal(
    Math.abs(displayValue),
    decimalPlaces,
    compact
  )

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
    return standardDecimalFormatters[0].format(Math.round(rate))
  }
  if (rate >= 100) {
    return standardDecimalFormatters[2].format(rate)
  }
  if (rate >= 1) return rate.toFixed(4)
  return rate.toFixed(6)
}

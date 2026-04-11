export const MAX_IMPORT_LIMIT = 300
export const MAX_FILE_SIZE = 5 * 1024 * 1024

export const CATEGORIES = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'dining', label: 'Dining & Restaurants' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'travel', label: 'Travel' },
  { value: 'housing', label: 'Housing & Rent' },
  { value: 'income', label: 'Income' },
  { value: 'investments', label: 'Investments' },
  { value: 'other', label: 'Other' }
]

export const PAYMENT_METHODS_ENUM = {
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  MOBILE_PAYMENT: 'MOBILE_PAYMENT',
  CASH: 'CASH',
  AUTO_DEBIT: 'AUTO_DEBIT',
  OTHER: 'OTHER'
} as const

export const PAYMENT_METHODS = [
  { value: PAYMENT_METHODS_ENUM.CARD, label: 'Credit/Debit Card' },
  { value: PAYMENT_METHODS_ENUM.CASH, label: 'Cash' },
  { value: PAYMENT_METHODS_ENUM.BANK_TRANSFER, label: 'Bank Transfer' },
  { value: PAYMENT_METHODS_ENUM.MOBILE_PAYMENT, label: 'Mobile Payment' },
  { value: PAYMENT_METHODS_ENUM.AUTO_DEBIT, label: 'Auto Debit' },
  { value: PAYMENT_METHODS_ENUM.OTHER, label: 'Other' }
]

export const _TRANSACTION_FREQUENCY = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY'
} as const

export type TransactionFrequencyType = keyof typeof _TRANSACTION_FREQUENCY

export const _TRANSACTION_TYPE = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE'
} as const

export type _TransactionType = keyof typeof _TRANSACTION_TYPE

export const _TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
} as const

export type TransactionStatusType = keyof typeof _TRANSACTION_STATUS

export const _REPORT_STATUS = {
  SENT: 'SENT',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING'
} as const

export type ReportStatusType = keyof typeof _REPORT_STATUS

// 1. Enum cho các loại tiền tệ - Sắp xếp theo dòng thời gian (Đông sang Tây)
export const CURRENCY_ENUM = {
  AUD: 'AUD',
  JPY: 'JPY',
  KRW: 'KRW',
  CNY: 'CNY',
  SGD: 'SGD',
  VND: 'VND',
  THB: 'THB',
  INR: 'INR', // Bổ sung INR cho khớp múi giờ Ấn Độ mới thêm
  AED: 'AED', // Bổ sung AED cho khớp múi giờ Dubai mới thêm
  EUR: 'EUR',
  CHF: 'CHF',
  GBP: 'GBP',
  CAD: 'CAD',
  USD: 'USD',
  BRL: 'BRL' // Bổ sung BRL cho khớp múi giờ Nam Mỹ mới thêm
} as const

export type CurrencyType = keyof typeof CURRENCY_ENUM

// 2. Mapping Symbol
export const CURRENCY_SYMBOLS: Record<CurrencyType, string> = {
  [CURRENCY_ENUM.AUD]: 'A$',
  [CURRENCY_ENUM.JPY]: '¥',
  [CURRENCY_ENUM.KRW]: '₩',
  [CURRENCY_ENUM.CNY]: '¥',
  [CURRENCY_ENUM.SGD]: 'S$',
  [CURRENCY_ENUM.VND]: '₫',
  [CURRENCY_ENUM.THB]: '฿',
  [CURRENCY_ENUM.INR]: '₹',
  [CURRENCY_ENUM.AED]: 'د.إ',
  [CURRENCY_ENUM.EUR]: '€',
  [CURRENCY_ENUM.CHF]: 'CHF',
  [CURRENCY_ENUM.GBP]: '£',
  [CURRENCY_ENUM.CAD]: 'C$',
  [CURRENCY_ENUM.USD]: '$',
  [CURRENCY_ENUM.BRL]: 'R$'
}

// 3. Options Currency - Thứ tự chuẩn đồng bộ với Timezone bên dưới
export const CURRENCY_OPTIONS = [
  { value: CURRENCY_ENUM.AUD, label: 'AUD - Australian Dollar' },
  { value: CURRENCY_ENUM.JPY, label: 'JPY - Japanese Yen' },
  { value: CURRENCY_ENUM.KRW, label: 'KRW - South Korean Won' },
  { value: CURRENCY_ENUM.CNY, label: 'CNY - Chinese Yuan' },
  { value: CURRENCY_ENUM.SGD, label: 'SGD - Singapore Dollar' },
  { value: CURRENCY_ENUM.VND, label: 'VND - Vietnam Dong' },
  { value: CURRENCY_ENUM.THB, label: 'THB - Thai Baht' },
  { value: CURRENCY_ENUM.INR, label: 'INR - Indian Rupee' },
  { value: CURRENCY_ENUM.AED, label: 'AED - UAE Dirham' },
  { value: CURRENCY_ENUM.EUR, label: 'EUR - Euro' },
  { value: CURRENCY_ENUM.CHF, label: 'CHF - Swiss Franc' },
  { value: CURRENCY_ENUM.GBP, label: 'GBP - British Pound' },
  { value: CURRENCY_ENUM.CAD, label: 'CAD - Canadian Dollar' },
  { value: CURRENCY_ENUM.USD, label: 'USD - US Dollar' },
  { value: CURRENCY_ENUM.BRL, label: 'BRL - Brazilian Real' }
]

// 4. Options Timezone - Đồng bộ 1-1 với thứ tự Currency ở trên
export const TIMEZONE_OPTIONS = [
  // Châu Úc (Bắt đầu ngày mới sớm nhất)
  { value: 'Australia/Sydney', label: '(UTC+10:00) Sydney, Melbourne' },

  // Châu Á (Viễn Đông sang Trung Đông)
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Seoul, Tokyo' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Beijing, Singapore' },
  { value: 'Asia/Saigon', label: '(UTC+07:00) Bangkok, Hanoi, Jakarta' },
  { value: 'Asia/Kolkata', label: '(UTC+05:30) Chennai, Mumbai, New Delhi' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Abu Dhabi, Dubai' },

  // Châu Âu
  { value: 'Europe/Paris', label: '(UTC+01:00) Berlin, Paris, Zurich' },
  { value: 'Europe/London', label: '(UTC+00:00) London, Dublin' },

  // Châu Mỹ (Muộn nhất)
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) Brasilia, Buenos Aires' },
  {
    value: 'America/New_York',
    label: '(UTC-05:00) Eastern Time (US & Canada)'
  },
  { value: 'America/Chicago', label: '(UTC-06:00) Central Time (US & Canada)' },
  {
    value: 'America/Los_Angeles',
    label: '(UTC-08:00) Pacific Time (US & Canada)'
  }
]

// 5. BỘ TỪ ĐIỂN ÁNH XẠ (Giữ nguyên logic của bạn)
export const TIMEZONE_ALIAS_MAPPING: Record<string, string> = {
  'Asia/Bangkok': 'Asia/Saigon',
  'Asia/Jakarta': 'Asia/Saigon',
  'Asia/Ho_Chi_Minh': 'Asia/Saigon',
  'Asia/Phnom_Penh': 'Asia/Saigon',
  'Asia/Vientiane': 'Asia/Saigon',
  'Asia/Shanghai': 'Asia/Singapore',
  'Asia/Hong_Kong': 'Asia/Singapore',
  'Asia/Taipei': 'Asia/Singapore',
  'Asia/Kuala_Lumpur': 'Asia/Singapore',
  'Asia/Manila': 'Asia/Singapore',
  'Asia/Macau': 'Asia/Singapore',
  'Asia/Seoul': 'Asia/Tokyo',
  'Asia/Pyongyang': 'Asia/Tokyo',
  'Australia/Melbourne': 'Australia/Sydney',
  'Australia/Brisbane': 'Australia/Sydney',
  'Pacific/Guam': 'Australia/Sydney',
  'Europe/Dublin': 'Europe/London',
  'Europe/Lisbon': 'Europe/London',
  'Africa/Casablanca': 'Europe/London',
  'Europe/Berlin': 'Europe/Paris',
  'Europe/Zurich': 'Europe/Paris',
  'Europe/Rome': 'Europe/Paris',
  'Europe/Madrid': 'Europe/Paris',
  'Europe/Amsterdam': 'Europe/Paris',
  'Europe/Brussels': 'Europe/Paris',
  'Europe/Vienna': 'Europe/Paris',
  'Africa/Lagos': 'Europe/Paris',
  'America/Toronto': 'America/New_York',
  'America/Havana': 'America/New_York',
  'America/Bogota': 'America/New_York',
  'America/Lima': 'America/New_York',
  'America/Mexico_City': 'America/Chicago',
  'America/Monterrey': 'America/Chicago',
  'America/Vancouver': 'America/Los_Angeles',
  'America/Tijuana': 'America/Los_Angeles',
  'America/Buenos_Aires': 'America/Sao_Paulo',
  'America/Santiago': 'America/Sao_Paulo',
  'America/Montevideo': 'America/Sao_Paulo'
}

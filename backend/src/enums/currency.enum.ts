export const CurrencyEnum = {
  USD: 'USD', // United States
  VND: 'VND', // Vietnam
  EUR: 'EUR', // European Union
  GBP: 'GBP', // United Kingdom
  JPY: 'JPY', // Japan
  KRW: 'KRW', // South Korea
  CNY: 'CNY', // China
  SGD: 'SGD', // Singapore
  THB: 'THB', // Thailand
  AUD: 'AUD', // Australia
  CAD: 'CAD', // Canada
  CHF: 'CHF', // Switzerland
  HKD: 'HKD', // Hong Kong
  INR: 'INR', // India
  MYR: 'MYR', // Malaysia
  NZD: 'NZD', // New Zealand
  PHP: 'PHP', // Philippines
  IDR: 'IDR', // Indonesia
  SAR: 'SAR', // Saudi Arabia
  AED: 'AED' // UAE
} as const

export type CurrencyType = keyof typeof CurrencyEnum

export const CurrencyInfo: Record<
  CurrencyType,
  { name: string; country: string }
> = {
  USD: { name: 'US Dollar', country: 'United States' },
  VND: { name: 'Vietnamese Dong', country: 'Vietnam' },
  EUR: { name: 'Euro', country: 'European Union' },
  GBP: { name: 'British Pound', country: 'United Kingdom' },
  JPY: { name: 'Japanese Yen', country: 'Japan' },
  KRW: { name: 'Korean Won', country: 'South Korea' },
  CNY: { name: 'Chinese Yuan', country: 'China' },
  SGD: { name: 'Singapore Dollar', country: 'Singapore' },
  THB: { name: 'Thai Baht', country: 'Thailand' },
  AUD: { name: 'Australian Dollar', country: 'Australia' },
  CAD: { name: 'Canadian Dollar', country: 'Canada' },
  CHF: { name: 'Swiss Franc', country: 'Switzerland' },
  HKD: { name: 'Hong Kong Dollar', country: 'Hong Kong' },
  INR: { name: 'Indian Rupee', country: 'India' },
  MYR: { name: 'Malaysian Ringgit', country: 'Malaysia' },
  NZD: { name: 'New Zealand Dollar', country: 'New Zealand' },
  PHP: { name: 'Philippine Peso', country: 'Philippines' },
  IDR: { name: 'Indonesian Rupiah', country: 'Indonesia' },
  SAR: { name: 'Saudi Riyal', country: 'Saudi Arabia' },
  AED: { name: 'UAE Dirham', country: 'UAE' }
}

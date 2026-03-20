export enum CurrencyEnum {
  USD = 'USD', // United States
  VND = 'VND', // Vietnam
  EUR = 'EUR', // European Union
  GBP = 'GBP', // United Kingdom
  JPY = 'JPY', // Japan
  KRW = 'KRW', // South Korea
  CNY = 'CNY', // China
  SGD = 'SGD', // Singapore
  THB = 'THB', // Thailand
  AUD = 'AUD', // Australia
  CAD = 'CAD', // Canada
  CHF = 'CHF', // Switzerland
  HKD = 'HKD', // Hong Kong
  INR = 'INR', // India
  MYR = 'MYR', // Malaysia
  NZD = 'NZD', // New Zealand
  PHP = 'PHP', // Philippines
  IDR = 'IDR', // Indonesia
  SAR = 'SAR', // Saudi Arabia
  AED = 'AED' // UAE
}

export const CurrencyInfo: Record<
  CurrencyEnum,
  { name: string; country: string }
> = {
  [CurrencyEnum.USD]: { name: 'US Dollar', country: 'United States' },
  [CurrencyEnum.VND]: { name: 'Vietnamese Dong', country: 'Vietnam' },
  [CurrencyEnum.EUR]: { name: 'Euro', country: 'European Union' },
  [CurrencyEnum.GBP]: { name: 'British Pound', country: 'United Kingdom' },
  [CurrencyEnum.JPY]: { name: 'Japanese Yen', country: 'Japan' },
  [CurrencyEnum.KRW]: { name: 'Korean Won', country: 'South Korea' },
  [CurrencyEnum.CNY]: { name: 'Chinese Yuan', country: 'China' },
  [CurrencyEnum.SGD]: { name: 'Singapore Dollar', country: 'Singapore' },
  [CurrencyEnum.THB]: { name: 'Thai Baht', country: 'Thailand' },
  [CurrencyEnum.AUD]: { name: 'Australian Dollar', country: 'Australia' },
  [CurrencyEnum.CAD]: { name: 'Canadian Dollar', country: 'Canada' },
  [CurrencyEnum.CHF]: { name: 'Swiss Franc', country: 'Switzerland' },
  [CurrencyEnum.HKD]: { name: 'Hong Kong Dollar', country: 'Hong Kong' },
  [CurrencyEnum.INR]: { name: 'Indian Rupee', country: 'India' },
  [CurrencyEnum.MYR]: { name: 'Malaysian Ringgit', country: 'Malaysia' },
  [CurrencyEnum.NZD]: { name: 'New Zealand Dollar', country: 'New Zealand' },
  [CurrencyEnum.PHP]: { name: 'Philippine Peso', country: 'Philippines' },
  [CurrencyEnum.IDR]: { name: 'Indonesian Rupiah', country: 'Indonesia' },
  [CurrencyEnum.SAR]: { name: 'Saudi Riyal', country: 'Saudi Arabia' },
  [CurrencyEnum.AED]: { name: 'UAE Dirham', country: 'UAE' }
}

export type CurrencyType = `${CurrencyEnum}`

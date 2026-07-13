import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ArrowRightLeft, RefreshCw } from 'lucide-react'
import CurrencyInput from 'react-currency-input-field'
import { CurrencyEnum } from '@/shared/types/currency.enum'
import { CURRENCY_SYMBOLS } from '@/constant'
import {
  formatCurrency,
  formatRate,
  ZERO_DECIMAL_CURRENCIES
} from '@/lib/format-currency'

interface CurrencyConverterProps {
  rates: Record<string, number>
  baseCurrency: string
}

const CurrencyConverter = ({ rates, baseCurrency }: CurrencyConverterProps) => {
  const [amount, setAmount] = useState<string>('1')
  const [fromCurrency, setFromCurrency] = useState<string>(baseCurrency)
  const [toCurrency, setToCurrency] = useState<string>(CurrencyEnum.USD)

  const currencies = Object.values(CurrencyEnum)

  const handleSwap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  // Logic quy đổi:
  // Vì base là VND, nên:
  // Rate(From/To) = Rate(Base/To) / Rate(Base/From)
  const rateFrom = rates[fromCurrency] || 1
  const rateTo = rates[toCurrency] || 1
  const convertedAmount = (Number(amount) * rateTo) / rateFrom

  return (
    <Card className="!shadow-none border-1 border-gray-100 dark:border-border">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Quick Converter
        </CardTitle>
        <CardDescription>
          Convert between your favorite currencies instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="amount-input">
            Amount
          </label>
          <CurrencyInput
            id="amount-input"
            name="amount"
            placeholder="Enter amount..."
            decimalsLimit={
              ZERO_DECIMAL_CURRENCIES.includes(fromCurrency) ? 0 : 2
            }
            value={amount}
            onValueChange={(value) => setAmount(value || '0')}
            prefix={`${CURRENCY_SYMBOLS[fromCurrency as keyof typeof CURRENCY_SYMBOLS] || ''} `}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-2">
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="from-currency"
            >
              From
            </label>
            <Select value={fromCurrency} onValueChange={setFromCurrency}>
              <SelectTrigger id="from-currency" className="w-full">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={`from-${c}`} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={handleSwap}
            className="mb-1"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>

          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="to-currency"
            >
              To
            </label>
            <Select value={toCurrency} onValueChange={setToCurrency}>
              <SelectTrigger id="to-currency" className="w-full">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={`to-${c}`} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-dashed">
          <p className="text-sm text-muted-foreground mb-1">Result</p>
          <div className="flex flex-col">
            <span className="text-3xl font-bold text-primary">
              {formatCurrency(convertedAmount, { currency: toCurrency })}
            </span>
            {/* ✅ Dùng formatRate thay vì .toFixed(4) cứng */}
            <span className="text-xs text-muted-foreground mt-1">
              1 {fromCurrency} = {formatRate(rateTo / rateFrom, toCurrency)}{' '}
              {toCurrency}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CurrencyConverter

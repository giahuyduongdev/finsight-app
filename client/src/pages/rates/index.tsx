import { useEffect, useState } from 'react'
import { useSocket } from '@/hooks/use-socket'
import { useTypedSelector } from '@/app/hook'
import { useGetExchangeRatesQuery } from '@/features/analytics/analyticsAPI'
import PageLayout from '@/components/page-layout'
import CurrencyConverter from '@/components/rates/currency-converter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe, TrendingUp, HelpCircle, RefreshCw } from 'lucide-react'
import { formatCurrency, formatRate } from '@/lib/format-currency'
import { Skeleton } from '@/components/ui/skeleton'

export interface ExchangeRates {
  base: string
  rates: Record<string, number>
  usedCurrencies?: string[]
  updatedAt: string
}

const RatesPage = () => {
  const socket = useSocket()
  const { data: initialData, refetch, isFetching } = useGetExchangeRatesQuery()
  const [rates, setRates] = useState<ExchangeRates | null>(null)
  const [isConnected, setIsConnected] = useState(socket?.connected || false)
  const preferredCurrency =
    useTypedSelector((state) => state.auth.user?.preferredCurrency) || 'VND'

  // Sync initial data from API
  useEffect(() => {
    if (initialData?.data) {
      setRates(initialData.data)
    }
  }, [initialData])

  useEffect(() => {
    if (!socket) return

    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)
    const handleRatesUpdate = (data: ExchangeRates) => {
      setRates(data)
    }

    // Set initial status
    setIsConnected(socket.connected)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('currency:rates_updated', handleRatesUpdate)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('currency:rates_updated', handleRatesUpdate)
    }
  }, [socket])

  const currencyList = rates?.rates ? Object.entries(rates.rates) : []

  return (
    <PageLayout
      title="Exchange Rates"
      subtitle="Real-time currency prices and converter"
    >
      <div className="flex flex-col gap-6">
        {/* Status Bar */}
        <div className="flex items-center justify-between bg-white dark:bg-card p-4 rounded-xl border border-gray-100 dark:border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Market Status</p>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                />
                <span className="text-xs text-muted-foreground">
                  {isConnected
                    ? 'Connected to Live Feed'
                    : 'Offline - Using Cached Rates'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 h-8"
            >
              <RefreshCw
                className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Last updated</p>
              <p className="text-sm font-mono">
                {rates?.updatedAt
                  ? new Date(rates.updatedAt).toLocaleTimeString()
                  : '---'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rates Table */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="!shadow-none border-1 border-gray-100 dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Market Overview</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Rates relative to {preferredCurrency}
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="relative w-full overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-border text-muted-foreground">
                        <th className="h-10 px-2 text-left font-medium">
                          Currency
                        </th>
                        <th className="h-10 px-2 text-right font-medium">
                          Exchange Rate
                        </th>
                        <th className="h-10 px-2 text-right font-medium">
                          Value in {preferredCurrency}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-border/50">
                      {!rates
                        ? [1, 2, 3, 4, 5].map((i) => (
                            <tr key={i}>
                              <td className="p-4">
                                <Skeleton className="h-4 w-20" />
                              </td>
                              <td className="p-4">
                                <Skeleton className="h-4 w-24 ml-auto" />
                              </td>
                              <td className="p-4">
                                <Skeleton className="h-4 w-32 ml-auto" />
                              </td>
                            </tr>
                          ))
                        : currencyList.map(([code, rateFromVND]) => {
                            // Tỉ giá của PreferredCurrency so với VND
                            const prefRateFromVND =
                              rates.rates[preferredCurrency] || 1

                            // Tỉ giá chéo: 1 PreferredCurrency = ? Code
                            // Rate(Pref/Code) = Rate(VND/Code) / Rate(VND/Pref)
                            const crossRate = rateFromVND / prefRateFromVND

                            // Giá trị của 1 Code tính bằng PreferredCurrency
                            // Value(Code in Pref) = 1 / crossRate
                            const valueInPref = 1 / crossRate

                            return (
                              <tr
                                key={code}
                                className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group"
                              >
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="font-mono"
                                    >
                                      {code}
                                    </Badge>
                                    {code === preferredCurrency && (
                                      <Badge className="bg-primary/10 text-primary border-none text-[10px] h-4">
                                        Base
                                      </Badge>
                                    )}
                                    {rates.usedCurrencies?.includes(code) &&
                                      code !== preferredCurrency && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] h-4"
                                        >
                                          In Use
                                        </Badge>
                                      )}
                                  </div>
                                </td>
                                <td className="p-4 text-right font-mono">
                                  {/* ✅ Dùng formatRate thay vì .toFixed(4) cứng */}
                                  1 {preferredCurrency} ={' '}
                                  {formatRate(crossRate, code)} {code}
                                </td>
                                <td className="p-4 text-right font-bold">
                                  {formatCurrency(valueInPref, {
                                    currency: preferredCurrency
                                  })}
                                </td>
                              </tr>
                            )
                          })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg flex gap-3 border border-blue-100/50 dark:border-blue-900/20">
                  <HelpCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    These are mid-market exchange rates for informational
                    purposes. Actual bank rates for buying or selling may differ
                    slightly due to spreads and fees.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Converter Sidebar */}
          <div className="space-y-6">
            <CurrencyConverter
              rates={rates?.rates || {}}
              baseCurrency={preferredCurrency}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

export default RatesPage

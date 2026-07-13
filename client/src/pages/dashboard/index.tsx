import DashboardSummary from './dashboard-summary'
import PageLayout from '@/components/page-layout'
//import ExpenseBreakDown from "./expense-breakdown";
import DashboardRecentTransactions from './dashboard-recent-transactions'
import { lazy, Suspense, useState } from 'react'
import { DateRangeType } from '@/components/date-range-select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const DashboardDataChart = lazy(() => import('./dashboard-data-chart'))
const ExpensePieChart = lazy(() => import('./expense-pie-chart'))
const AREA_CHART_FALLBACK_BARS = [
  { key: 'bar-1', height: 40 },
  { key: 'bar-2', height: 70 },
  { key: 'bar-3', height: 100 },
  { key: 'bar-4', height: 130 },
  { key: 'bar-5', height: 40 },
  { key: 'bar-6', height: 70 },
  { key: 'bar-7', height: 100 },
  { key: 'bar-8', height: 130 }
] as const

const ChartPanelFallback = ({ variant }: { variant: 'area' | 'pie' }) => {
  if (variant === 'pie') {
    return (
      <Card className="!shadow-none border-1 border-gray-100 dark:border-border">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardHeader>
        <CardContent className="h-[313px]">
          <div className="w-full flex items-center justify-center">
            <div className="relative w-[200px] h-[200px]">
              <Skeleton className="rounded-full w-full h-full" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="!shadow-none border-1 border-gray-100 dark:border-border !pt-0">
      <CardHeader className="flex flex-col items-stretch !space-y-0 border-b border-gray-100 dark:border-border !p-0 pr-1 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-0 sm:py-0">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </div>
        <div className="flex">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-center even:border-l sm:border-l border-gray-100 dark:border-border sm:px-4 sm:py-6 min-w-36"
            >
              <Skeleton className="h-4 w-20 mx-auto" />
              <Skeleton className="h-8 w-24 mx-auto mt-1 sm:h-12" />
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-2 sm:px-6 sm:pt-2 h-[300px]">
        <div className="h-[220px] w-full flex items-end gap-2 px-4">
          {AREA_CHART_FALLBACK_BARS.map((bar) => (
            <Skeleton
              key={bar.key}
              className="flex-1"
              style={{ height: `${bar.height}px` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const Dashboard = () => {
  const [dateRange, _setDateRange] = useState<DateRangeType>(null)

  return (
    <div className="w-full flex flex-col">
      {/* Dashboard Summary Overview */}
      <PageLayout
        className="space-y-6"
        renderPageHeader={
          <DashboardSummary
            dateRange={dateRange}
            setDateRange={_setDateRange}
          />
        }
      >
        {/* Dashboard Main Section */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-6 gap-8">
          <div className="lg:col-span-4">
            <Suspense fallback={<ChartPanelFallback variant="area" />}>
              <DashboardDataChart dateRange={dateRange} />
            </Suspense>
          </div>
          <div className="lg:col-span-2">
            <Suspense fallback={<ChartPanelFallback variant="pie" />}>
              <ExpensePieChart dateRange={dateRange} />
            </Suspense>
          </div>
        </div>
        {/* Dashboard Recent Transactions */}
        <div className="w-full mt-0">
          <DashboardRecentTransactions
            dateRange={dateRange}
            setDateRange={_setDateRange}
          />
        </div>
      </PageLayout>
    </div>
  )
}

export default Dashboard

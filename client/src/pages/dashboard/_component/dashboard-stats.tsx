import { useSummaryAnalyticsQuery } from '@/features/analytics/analyticsAPI'
import SummaryCard from './summary-card'
import { DateRangeType } from '@/components/date-range-select'
import { useSelector } from 'react-redux'

const DashboardStats = ({ dateRange }: { dateRange?: DateRangeType }) => {
  const { data, isLoading } = useSummaryAnalyticsQuery(
    { preset: dateRange?.value },
    { skip: !dateRange }
  )
  const summaryData = data?.data
  const preferredCurrency =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSelector((state: any) => state.auth?.user?.preferredCurrency) || 'USD'
 
  return (
    <div className="flex flex-row items-center">
      <div className="flex-1 lg:flex-[1] grid grid-cols-1 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Available Balance"
          value={summaryData?.availableBalance}
          dateRange={dateRange}
          percentageChange={summaryData?.percentageChange?.balance}
          isLoading={isLoading && !data}
          cardType="balance"
          currency={preferredCurrency}
        />
        <SummaryCard
          title="Total Income"
          value={summaryData?.totalIncome}
          percentageChange={summaryData?.percentageChange?.income}
          dateRange={dateRange}
          isLoading={isLoading && !data}
          cardType="income"
          currency={preferredCurrency}
        />
        <SummaryCard
          title="Total Expenses"
          value={summaryData?.totalExpenses}
          dateRange={dateRange}
          percentageChange={summaryData?.percentageChange?.expenses}
          isLoading={isLoading && !data}
          cardType="expenses"
          currency={preferredCurrency}
        />
        <SummaryCard
          title="Savings Rate"
          value={summaryData?.savingRate?.percentage}
          expenseRatio={summaryData?.savingRate?.expenseRatio}
          isPercentageValue
          dateRange={dateRange}
          isLoading={isLoading && !data}
          cardType="savings"
        />
      </div>
    </div>
  )
}

export default DashboardStats

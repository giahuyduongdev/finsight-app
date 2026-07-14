import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { useRecharts } from '@/components/ui/use-recharts'
import { DateRangeType } from '@/components/date-range-select/date-range-options'
import { formatCurrency } from '@/lib/format-currency'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPercentage } from '@/lib/format-percentage'
import { EmptyState } from '@/components/empty-state'
import { useExpensePieChartBreakdownQuery } from '@/features/analytics/analyticsAPI'
import { useSelector } from 'react-redux'
import { RootState } from '@/app/store'

const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)'
]

// Create chart config for shadcn UI chart
const chartConfig = {
  amount: {
    label: 'Amount'
  }
} satisfies ChartConfig

type ExpenseCategory = {
  name: string
  value: number
  percentage: number
}

const isCenterViewBox = (
  viewBox: unknown
): viewBox is { cx: number; cy: number } => {
  return (
    typeof viewBox === 'object' &&
    viewBox !== null &&
    'cx' in viewBox &&
    'cy' in viewBox &&
    typeof viewBox.cx === 'number' &&
    typeof viewBox.cy === 'number'
  )
}

const CustomLegend = ({
  categories,
  preferredCurrency
}: {
  categories: ExpenseCategory[]
  preferredCurrency: string
}) => {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-2 mt-4">
      {categories.map((entry, index) => (
        <div key={`legend-${entry.name}`} className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: COLORS[index % COLORS.length] }}
          ></div>
          <div className="flex justify-between w-full">
            <span className="text-xs font-medium truncate capitalize">
              {entry.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatCurrency(entry.value, { currency: preferredCurrency })}
              </span>
              <span className="text-xs text-muted-foreground/60">
                ({formatPercentage(entry.percentage, { decimalPlaces: 0 })})
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const ExpensePieChart = (props: { dateRange?: DateRangeType }) => {
  const { dateRange } = props
  const recharts = useRecharts()

  const preferredCurrency =
    useSelector((state: RootState) => state.auth?.user?.preferredCurrency) ||
    'USD'

  const { data, isLoading } = useExpensePieChartBreakdownQuery({
    preset: dateRange?.value,
    from: dateRange?.from?.toISOString(),
    to: dateRange?.to?.toISOString()
  })
  const categories: ExpenseCategory[] = data?.data?.breakdown || []
  const totalSpent = data?.data?.totalSpent || 0

  // Chỉ hiện Skeleton nếu thực sự KHÔNG có dữ liệu (lần đầu load)
  if (isLoading && !data) {
    return <PieChartSkeleton />
  }
  return (
    <Card className="!shadow-none border-1 border-gray-100 dark:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Expenses Breakdown</CardTitle>
        <CardDescription>Total expenses {dateRange?.label}</CardDescription>
      </CardHeader>
      <CardContent className="h-[313px]">
        <div className=" w-full">
          {categories?.length === 0 ? (
            <EmptyState
              title="No expenses found"
              description="There are no expenses recorded for this period."
            />
          ) : !recharts ? (
            <PieChartSkeleton />
          ) : (
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square h-[300px]"
            >
              <recharts.PieChart key={preferredCurrency}>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [
                        formatCurrency(Number(value), {
                          currency: preferredCurrency
                        }),
                        'Amount'
                      ]}
                    />
                  }
                />

                <recharts.Pie
                  data={categories}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {categories.map((category, index) => (
                    <recharts.Cell
                      key={`cell-${category.name}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}

                  <recharts.Label
                    content={({ viewBox }: { viewBox?: unknown }) => {
                      if (isCenterViewBox(viewBox)) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-2xl font-bold"
                            >
                              {formatCurrency(totalSpent, {
                                currency: preferredCurrency
                              })}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 20}
                              className="fill-muted-foreground text-xs"
                            >
                              Total Spent
                            </tspan>
                          </text>
                        )
                      }

                      return null
                    }}
                  />
                </recharts.Pie>
                <ChartLegend
                  content={
                    <CustomLegend
                      categories={categories}
                      preferredCurrency={preferredCurrency}
                    />
                  }
                />
              </recharts.PieChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const PieChartSkeleton = () => (
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
      <div className="mt-0 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)

export default ExpensePieChart

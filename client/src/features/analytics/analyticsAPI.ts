import { apiClient } from '@/app/api-client'
import {
  ChartAnalyticsResponse,
  ExchangeRatesResponse,
  ExpensePieChartBreakdownResponse,
  FilterParams,
  SummaryAnalyticsResponse
} from './anayticsType'

export const analyticsApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    summaryAnalytics: builder.query<SummaryAnalyticsResponse, FilterParams>({
      query: ({ preset, from, to }) => ({
        url: '/analytics/summary',
        method: 'GET',
        params: { preset, from, to }
      }),
      providesTags: ['analytics']
    }),
    chartAnalytics: builder.query<ChartAnalyticsResponse, FilterParams>({
      query: ({ preset, from, to }) => ({
        url: '/analytics/chart',
        method: 'GET',
        params: { preset, from, to }
      }),
      providesTags: ['analytics']
    }),
    expensePieChartBreakdown: builder.query<
      ExpensePieChartBreakdownResponse,
      FilterParams
    >({
      query: ({ preset, from, to }) => ({
        url: '/analytics/expense-breakdown',
        method: 'GET',
        params: { preset, from, to }
      }),
      providesTags: ['analytics']
    }),
    getExchangeRates: builder.query<ExchangeRatesResponse, void>({
      query: () => ({
        url: '/analytics/rates',
        method: 'GET'
      }),
      providesTags: ['analytics']
    }),
    refreshExchangeRates: builder.mutation<ExchangeRatesResponse, void>({
      query: () => ({
        url: '/analytics/rates/refresh',
        method: 'POST'
      })
    })
  })
})

export const {
  useSummaryAnalyticsQuery,
  useChartAnalyticsQuery,
  useExpensePieChartBreakdownQuery,
  useGetExchangeRatesQuery,
  useRefreshExchangeRatesMutation
} = analyticsApi

import { apiClient } from '@/app/api-client'
import { GetAllReportResponse, UpdateReportSettingParams } from './reportType'

export const reportApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    getAllReports: builder.query<
      GetAllReportResponse,
      { pageNumber: number; pageSize: number }
    >({
      query: (params) => {
        const { pageNumber = 1, pageSize = 20 } = params
        return {
          url: '/reports',
          method: 'GET',
          params: { pageNumber, pageSize }
        }
      },
      providesTags: ['report']
    }),

    updateReportSetting: builder.mutation<void, UpdateReportSettingParams>({
      query: (payload) => ({
        url: '/reports/settings',
        method: 'PATCH',
        body: payload
      }),
      invalidatesTags: ['report']
    }),
    resendReport: builder.mutation<{ message: string }, string>({
      query: (reportId) => ({
        url: `/reports/resend/${reportId}`,
        method: 'POST'
      }),
      invalidatesTags: ['report']
    })
  })
})

export const {
  useGetAllReportsQuery,
  useUpdateReportSettingMutation,
  useResendReportMutation,
  usePrefetch
} = reportApi

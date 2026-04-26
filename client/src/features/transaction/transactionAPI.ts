import { apiClient } from '@/app/api-client'
import {
  AIScanReceiptResponse,
  BulkImportTransactionPayload,
  CreateTransactionBody,
  GetAllTransactionParams,
  GetAllTransactionResponse,
  GetChildTransactionsResponse,
  GetSingleTransactionResponse,
  UpdateTransactionPayload
} from './transationType'

export const transactionApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    createTransaction: builder.mutation<void, CreateTransactionBody>({
      query: (body) => ({
        url: '/transaction',
        method: 'POST',
        body: body
      }),
      invalidatesTags: ['transactions', 'analytics']
    }),

    aiScanReceipt: builder.mutation<AIScanReceiptResponse, FormData>({
      query: (formData) => ({
        url: '/transaction/scan-receipt',
        method: 'POST',
        body: formData
      })
    }),

    getAllTransactions: builder.query<
      GetAllTransactionResponse,
      GetAllTransactionParams
    >({
      query: (params) => {
        const {
          keyword = undefined,
          type = undefined,
          recurringStatus = undefined,
          currency,
          status,
          pageNumber = 1,
          pageSize = 10,
          dateRangePreset,
          from,
          to,
          timezone
        } = params

        const queryParams: Record<string, unknown> = { pageNumber, pageSize }
        if (keyword) queryParams.keyword = keyword
        if (type) queryParams.type = type
        if (recurringStatus) queryParams.recurringStatus = recurringStatus
        if (currency) queryParams.currency = currency
        if (status) queryParams.status = status
        if (dateRangePreset) queryParams.dateRangePreset = dateRangePreset
        if (from) queryParams.from = from
        if (to) queryParams.to = to
        if (timezone) queryParams.timezone = timezone

        return {
          url: '/transaction/all',
          method: 'GET',
          params: queryParams
        }
      },
      providesTags: ['transactions'],
      keepUnusedDataFor: 60
    }),

    getSingleTransaction: builder.query<GetSingleTransactionResponse, string>({
      query: (id) => ({
        url: `/transaction/${id}`,
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache', // Ép trình duyệt tuyệt đối không dùng Cache cũ
          Pragma: 'no-cache',
          Expires: '0'
        }
      }),
      providesTags: ['transactions'] // Kế nối Cache này vào nhóm 'transactions'
    }),

    duplicateTransaction: builder.mutation<void, string>({
      query: (id) => ({
        url: `/transaction/${id}/duplicate`,
        method: 'POST'
      }),
      invalidatesTags: ['transactions']
    }),

    updateTransaction: builder.mutation<void, UpdateTransactionPayload>({
      query: ({ id, transaction }) => ({
        url: `/transaction/${id}`,
        method: 'PUT',
        body: transaction
      }),
      invalidatesTags: ['transactions', 'analytics'] // Update xong sẽ tự động giật sập Cache của GET ở trên
    }),

    bulkImportTransaction: builder.mutation<void, BulkImportTransactionPayload>(
      {
        query: (body) => ({
          url: '/transaction/bulk',
          method: 'POST',
          body
        })
        // Không dùng invalidatesTags ở đây vì backend trả về 202 ngay lập tức
        // (worker xử lý async), nên invalidate tức thì sẽ refetch khi DB còn trống.
        // Thay vào đó, component sẽ tự dispatch invalidateTags sau một khoảng delay.
      }
    ),

    deleteTransaction: builder.mutation<void, string>({
      query: (id) => ({
        url: `/transaction/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['transactions', 'analytics']
    }),

    getChildTransactions: builder.query<GetChildTransactionsResponse, { id: string; pageNumber: number; pageSize?: number }>({
      query: ({ id, pageNumber, pageSize = 10 }) => ({
        url: `/transaction/${id}/children`,
        method: 'GET',
        params: { pageNumber, pageSize }
      }),
      providesTags: ['transactions']
    }),

    bulkDeleteTransaction: builder.mutation<void, string[]>({
      query: (transactionIds) => ({
        url: '/transaction/bulk',
        method: 'DELETE',
        body: {
          transactionIds
        }
      }),
      invalidatesTags: ['transactions', 'analytics']
    })
  })
})

export const {
  useCreateTransactionMutation,
  useGetAllTransactionsQuery,
  useAiScanReceiptMutation,
  useGetSingleTransactionQuery,
  useGetChildTransactionsQuery,
  useLazyGetChildTransactionsQuery,
  useDuplicateTransactionMutation,
  useUpdateTransactionMutation,
  useBulkImportTransactionMutation,
  useDeleteTransactionMutation,
  useBulkDeleteTransactionMutation,
  usePrefetch
} = transactionApi

import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError
} from '@reduxjs/toolkit/query/react'
import { RootState } from './store'
import { logout, updateCredentials } from '@/features/auth/authSlice'

const API_VERSION = '/v1'

export const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

  if (apiUrl.endsWith(API_VERSION)) return apiUrl

  return `${apiUrl.replace(/\/$/, '')}${API_VERSION}`
}

const isRefreshPayload = (
  value: unknown
): value is { accessToken: string; expiresAt: number } =>
  typeof value === 'object' &&
  value !== null &&
  'accessToken' in value &&
  'expiresAt' in value &&
  typeof value.accessToken === 'string' &&
  typeof value.expiresAt === 'number'

const baseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const auth = (getState() as RootState).auth
    if (auth?.accessToken) {
      headers.set('Authorization', `Bearer ${auth.accessToken}`)
    }
    return headers
  }
})

// Shared promise to prevent multiple simultaneous refresh requests
let refreshPromise: Promise<unknown> | null = null

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // 1. CHẶN ĐẦU: Nếu không có accessToken trong store, không làm gì cả (tránh chạy bậy khi đã logout)
  const auth = (api.getState() as RootState).auth
  const accessToken = auth?.accessToken

  // Chạy request gốc
  let result = await baseQuery(args, api, extraOptions)

  // 2. KIỂM TRA ĐIỀU KIỆN RE-AUTH
  if (result.error && result.error.status === 401) {
    // LẤY URL CỦA REQUEST ĐANG LỖI
    const url = typeof args === 'string' ? args : args.url

    if (url.includes('/auth/refresh-token')) {
      api.dispatch(logout())
      refreshPromise = null // Reset on logout
      return result
    }

    // Chỉ thử refresh nếu trong store vẫn còn dấu hiệu đang đăng nhập (có accessToken)
    if (accessToken) {
      // Use shared promise to prevent race condition
      if (!refreshPromise) {
        refreshPromise = Promise.resolve(
          baseQuery(
            { url: '/auth/refresh-token', method: 'POST' },
            api,
            extraOptions
          )
        ).finally(() => {
          // Clear the promise after completion (success or failure)
          refreshPromise = null
        })
      }

      const refreshResult = await refreshPromise

      if (
        refreshResult &&
        typeof refreshResult === 'object' &&
        'data' in refreshResult &&
        refreshResult.data
      ) {
        const refreshData =
          typeof refreshResult.data === 'object' &&
          refreshResult.data &&
          'data' in refreshResult.data
            ? (refreshResult.data as { data: unknown }).data
            : refreshResult.data

        if (!isRefreshPayload(refreshData)) {
          api.dispatch(logout())
          return result
        }

        const { accessToken, expiresAt } = refreshData
        api.dispatch(updateCredentials({ accessToken, expiresAt }))

        // GỬI LẠI request gốc
        result = await baseQuery(args, api, extraOptions)
      } else {
        // Nếu gọi Refresh mà không có data (lỗi 400, 500, hoặc 401 lần nữa)
        api.dispatch(logout())
      }
    }
  }

  return result
}
export const apiClient = createApi({
  reducerPath: 'api', // Add API client reducer to root reducer
  baseQuery: baseQueryWithReauth,
  refetchOnMountOrArgChange: 60,
  // refetchOnMountOrArgChange: true, // Refetch on mount or arg change
  tagTypes: ['transactions', 'analytics', 'report', 'user'], // Tag types for RTK Query
  endpoints: () => ({}) // Endpoints for RTK Query
})

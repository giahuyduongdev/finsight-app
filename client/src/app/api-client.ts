import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError
} from '@reduxjs/toolkit/query/react'
import { RootState } from './store'
import { logout, updateCredentials } from '@/features/auth/authSlice'

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const auth = (getState() as RootState).auth
    if (auth?.accessToken) {
      headers.set('Authorization', `Bearer ${auth.accessToken}`)
    }
    return headers
  }
})

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
      return result
    }

    // Chỉ thử refresh nếu trong store vẫn còn dấu hiệu đang đăng nhập (có accessToken)
    if (accessToken) {
      const refreshResult = await baseQuery(
        { url: '/auth/refresh-token', method: 'POST' },
        api,
        extraOptions
      )

      if (refreshResult.data) {
        const { accessToken, expiresAt } = refreshResult.data as {
          accessToken: string
          expiresAt: number
        }
        api.dispatch(updateCredentials({ accessToken, expiresAt }))

        await new Promise((resolve) => setTimeout(resolve, 200))

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

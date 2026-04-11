import { apiClient } from '@/app/api-client'
import { GetCurrentUserResponse } from '@/@types/user.type'

export const authApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation({
      query: (credentials) => ({
        url: '/auth/register',
        method: 'POST',
        body: credentials
      })
    }),
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials
      })
    }),
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST'
      })
    }),
    refresh: builder.mutation({
      query: () => ({
        url: '/auth/refresh-token',
        method: 'POST'
      })
    }),
    getMe: builder.query({
      query: (token?: string) => ({
        url: '/user/current-user',
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      }),

      transformResponse: (response: GetCurrentUserResponse) => response.user
    })
  })
})

export const {
  useLoginMutation,
  useRefreshMutation,
  useRegisterMutation,
  useLogoutMutation,
  useLazyGetMeQuery
} = authApi

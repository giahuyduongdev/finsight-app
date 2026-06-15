import { apiClient } from '@/app/api-client'
import { updateCredentials } from '@/features/auth/authSlice'
import { GetCurrentUserResponse, UpdateUserResponse } from './userType'

export const userApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentUser: builder.query<GetCurrentUserResponse, void>({
      query: () => ({
        url: '/users/me',
        method: 'GET'
      }),
      providesTags: ['user'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(updateCredentials({ user: data.data }))
        } catch {
          // Socket-triggered profile refetch is best-effort.
        }
      }
    }),
    updateUser: builder.mutation<UpdateUserResponse, FormData>({
      query: (formData) => ({
        url: '/users/me',
        method: 'PATCH',
        body: formData
      }),
      invalidatesTags: ['analytics', 'user']
    })
  })
})

export const { useGetCurrentUserQuery, useUpdateUserMutation } = userApi

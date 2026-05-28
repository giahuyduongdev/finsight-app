import { apiClient } from '@/app/api-client'
import { UpdateUserResponse } from './userType'

export const userApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
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

export const { useUpdateUserMutation } = userApi

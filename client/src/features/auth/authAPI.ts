import { apiClient } from '@/app/api-client'
import { GetCurrentUserResponse } from '@/@types/user.type'

type ApiSuccessResponse<T> = {
  data: T
  meta?: {
    message?: string
  }
}

type AuthCredentials = {
  accessToken: string
  expiresAt: number
  user: unknown
  reportSetting?: unknown
  timezone?: string
}

type RefreshCredentials = {
  accessToken: string
  expiresAt: number
}

const unwrapRefreshCredentials = (
  response: RefreshCredentials | ApiSuccessResponse<RefreshCredentials>
): RefreshCredentials => ('data' in response ? response.data : response)

export const authApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Login / Logout ───────────────────────────────────────────────────────
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials
      }),
      transformResponse: (response: ApiSuccessResponse<AuthCredentials>) =>
        response.data
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
      }),
      transformResponse: unwrapRefreshCredentials
    }),

    getMe: builder.query({
      query: (token?: string) => ({
        url: '/users/me',
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      }),
      transformResponse: (
        response: GetCurrentUserResponse | ApiSuccessResponse<unknown>
      ) => ('data' in response ? response.data : response.user)
    }),

    // ─── Đăng ký với OTP ─────────────────────────────────────────────────────

    /** Bước 1: Gửi thông tin đăng ký → nhận OTP qua email */
    registerOTP: builder.mutation<
      { message: string },
      { name: string; email: string; password: string; timezone?: string }
    >({
      query: (credentials) => ({
        url: '/auth/register',
        method: 'POST',
        body: credentials
      })
    }),

    /** Bước 2: Xác thực OTP → tạo tài khoản */
    verifyRegisterOTP: builder.mutation<
      { message: string; user: unknown },
      { email: string; otp: string }
    >({
      query: (body) => ({
        url: '/auth/register/verify-otp',
        method: 'POST',
        body
      })
    }),

    /** Bước 2b: Gửi lại OTP đăng ký */
    resendRegisterOTP: builder.mutation<{ message: string }, { email: string }>(
      {
        query: (body) => ({
          url: '/auth/register/resend',
          method: 'POST',
          body
        })
      }
    ),

    // ─── Quên mật khẩu ───────────────────────────────────────────────────────

    /** Bước 1: Nhập email → nhận OTP qua email */
    forgotPassword: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({
        url: '/auth/password/forgot',
        method: 'POST',
        body
      })
    }),

    /** Bước 2: Xác thực OTP → nhận resetToken */
    verifyForgotOTP: builder.mutation<
      { message: string; resetToken: string },
      { email: string; otp: string }
    >({
      query: (body) => ({
        url: '/auth/password/verify-otp',
        method: 'POST',
        body
      })
    }),

    /** Bước 2b: Gửi lại OTP quên mật khẩu */
    resendForgotOTP: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({
        url: '/auth/password/resend',
        method: 'POST',
        body
      })
    }),

    /** Bước 3: Đặt lại mật khẩu mới */
    resetPassword: builder.mutation<
      { message: string },
      { email: string; resetToken: string; newPassword: string }
    >({
      query: (body) => ({
        url: '/auth/password/reset',
        method: 'POST',
        body
      })
    }),
    /** Đổi mật khẩu (Yêu cầu OTP) */
    changePasswordRequest: builder.mutation<
      { message: string },
      { oldPassword: string; newPassword: string; confirmPassword: string }
    >({
      query: (body) => ({
        url: '/auth/password/change-request',
        method: 'POST',
        body
      })
    }),
    /** Xác thực OTP đổi mật khẩu */
    verifyChangePasswordOTP: builder.mutation<
      { message: string },
      { otp: string }
    >({
      query: (body) => ({
        url: '/auth/password/change-verify',
        method: 'POST',
        body
      })
    }),
    /** Gửi lại OTP đổi mật khẩu */
    resendChangePasswordOTP: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/auth/password/change-resend',
        method: 'POST'
      })
    }),
    /** Đổi Email (Yêu cầu OTP) */
    changeEmailRequest: builder.mutation<
      { message: string },
      { newEmail: string }
    >({
      query: (body) => ({
        url: '/auth/email/change-request',
        method: 'POST',
        body
      })
    }),
    /** Xác thực OTP đổi email */
    verifyChangeEmailOTP: builder.mutation<
      { message: string },
      { oldEmailOtp: string; newEmailOtp: string }
    >({
      query: (body) => ({
        url: '/auth/email/change-verify',
        method: 'POST',
        body
      })
    }),
    /** Gửi lại OTP đổi email */
    resendChangeEmailOTP: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/auth/email/change-resend',
        method: 'POST'
      })
    })
  })
})

export const {
  // Login / Logout
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useLazyGetMeQuery,

  // Đăng ký OTP
  useRegisterOTPMutation,
  useVerifyRegisterOTPMutation,
  useResendRegisterOTPMutation,

  // Quên mật khẩu
  useForgotPasswordMutation,
  useVerifyForgotOTPMutation,
  useResendForgotOTPMutation,
  useResetPasswordMutation,

  // Đổi mật khẩu
  useChangePasswordRequestMutation,
  useVerifyChangePasswordOTPMutation,
  useResendChangePasswordOTPMutation,

  // Đổi Email
  useChangeEmailRequestMutation,
  useVerifyChangeEmailOTPMutation,
  useResendChangeEmailOTPMutation
} = authApi

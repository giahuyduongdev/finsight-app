import { createSlice } from '@reduxjs/toolkit'
import { normalizeTimeZone } from '@/lib/timezone'

interface AuthState {
  accessToken: string | null
  expiresAt: number | null
  user: User | null
  reportSetting: ReportSetting | null
  timezone: string | null
  isInitialized: boolean
}

interface User {
  id: number
  name: string
  email: string
  profilePicture: string
  timezone?: string
  preferredCurrency?: string
}

interface ReportSetting {
  userId: string
  frequency?: string
  isEnabled: boolean
}

const initialState: AuthState = {
  accessToken: null,
  expiresAt: null,
  user: null,
  reportSetting: null,
  timezone: null,
  isInitialized: false
}

const normalizeUser = (user?: User | null): User | null => {
  if (!user) return null

  return {
    ...user,
    timezone: normalizeTimeZone(user.timezone) || user.timezone
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.accessToken = action.payload.accessToken
      state.expiresAt = action.payload.expiresAt
      state.user = normalizeUser(action.payload.user)
      state.reportSetting = action.payload.reportSetting
      state.timezone =
        normalizeTimeZone(action.payload.timezone) || action.payload.timezone
    },
    updateCredentials: (state, action) => {
      const { accessToken, expiresAt, user, reportSetting, timezone } =
        action.payload

      if (accessToken !== undefined) state.accessToken = accessToken
      if (expiresAt !== undefined) state.expiresAt = expiresAt
      if (user !== undefined) {
        state.user = normalizeUser({ ...state.user, ...user } as User)
      }
      if (reportSetting !== undefined)
        state.reportSetting = { ...state.reportSetting, ...reportSetting }
      if (timezone !== undefined)
        state.timezone = normalizeTimeZone(timezone) || timezone
    },

    setInitialized: (state) => {
      state.isInitialized = true
    },

    logout: (state) => {
      state.accessToken = null
      state.expiresAt = null
      state.user = null
      state.reportSetting = null
      state.timezone = null
    }
  }
})

export const { setCredentials, updateCredentials, setInitialized, logout } =
  authSlice.actions
export default authSlice.reducer

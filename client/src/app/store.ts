import { combineReducers, configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import storage from 'redux-persist/lib/storage'
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist'
import type { PersistedState } from 'redux-persist/es/types'
import { apiClient } from './api-client'
import { normalizeTimeZone } from '@/lib/timezone'
//import { encryptTransform } from 'redux-persist-transform-encrypt';

type RootReducerType = ReturnType<typeof rootReducer>

type PersistedAuthState = {
  user?: {
    timezone?: string
    [key: string]: unknown
  } | null
  timezone?: string | null
  [key: string]: unknown
}

const normalizePersistedAuthState = (
  state: PersistedAuthState
): PersistedAuthState => {
  const userTimezone = normalizeTimeZone(state.user?.timezone)
  const timezone = normalizeTimeZone(state.timezone ?? undefined)

  return {
    ...state,
    user: state.user
      ? {
          ...state.user,
          timezone: userTimezone || state.user.timezone
        }
      : state.user,
    timezone: timezone || state.timezone
  }
}

// Persist riêng cho auth — chỉ lưu user info, không lưu token
const authPersistConfig = {
  key: 'auth',
  storage,
  version: 1,
  migrate: (state: PersistedState): Promise<PersistedState> =>
    Promise.resolve(
      state
        ? (normalizePersistedAuthState(
            state as unknown as PersistedAuthState
          ) as unknown as PersistedState)
        : state
    ),
  blacklist: ['accessToken', 'expiresAt', 'isInitialized'] // ← chỉ blacklist token
}

const persistConfig = {
  key: 'root', // Key for the persisted data in storage
  storage, // Storage engine to use (localStorage)
  blacklist: ['auth', apiClient.reducerPath] // Specify which reducers not to persist (RTK Query cache)
  // transforms: [
  //     encryptTransform({
  //       secretKey: import.meta.env.VITE_REDUX_PERSIST_SECRET_KEY!,
  //       onError: function (error) {
  //         console.error('Encryption error:', error);
  //       },
  //     }),
  //   ],
}

const rootReducer = combineReducers({
  [apiClient.reducerPath]: apiClient.reducer, // Add API client reducer to root reducer
  auth: persistReducer(authPersistConfig, authReducer) // Add auth reducer to root reducer
})

// Create a persisted version of the root reducer
const persistedReducer = persistReducer<RootReducerType>(
  persistConfig,
  rootReducer
)

const reduxPersistActions = [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: reduxPersistActions /// Ignore specific actions in serializable checks
      }
    }).concat(apiClient.middleware)
})

export const persistor = persistStore(store) // Create a persistor linked to the store

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

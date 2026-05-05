import { useEffect, useRef } from 'react'
import { useAppDispatch, useTypedSelector } from '@/app/hook'
// 1. NHỚ IMPORT THÊM setInitialized TỪ authSlice
import {
  logout,
  updateCredentials,
  setInitialized
} from '@/features/auth/authSlice'
import { useRefreshMutation } from '@/features/auth/authAPI'

// Shared refresh coordination using BroadcastChannel
const REFRESH_CHANNEL_NAME = 'auth_refresh_channel'
const REFRESH_LOCK_KEY = 'auth_refresh_lock'
const REFRESH_LOCK_TIMEOUT = 5000 // 5 seconds

// Helper to acquire refresh lock (only one tab can refresh at a time)
const acquireRefreshLock = (): boolean => {
  const now = Date.now()
  const lockData = localStorage.getItem(REFRESH_LOCK_KEY)

  if (lockData) {
    const { timestamp } = JSON.parse(lockData)
    // If lock is expired, we can acquire it
    if (now - timestamp < REFRESH_LOCK_TIMEOUT) {
      return false // Lock is held by another tab
    }
  }

  // Acquire lock
  localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ timestamp: now }))
  return true
}

// Helper to release refresh lock
const releaseRefreshLock = () => {
  localStorage.removeItem(REFRESH_LOCK_KEY)
}

const useAuthExpiration = () => {
  // 2. LẤY THÊM isInitialized TỪ REDUX
  const { accessToken, expiresAt, isInitialized } = useTypedSelector(
    (state) => state.auth
  )
  const dispatch = useAppDispatch()
  const [refreshToken] = useRefreshMutation()

  const hasAttemptedRefresh = useRef(false)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)

  // Initialize BroadcastChannel for cross-tab communication
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(REFRESH_CHANNEL_NAME)
      broadcastChannelRef.current = channel

      // Listen for token updates from other tabs
      channel.onmessage = (event) => {
        if (event.data.type === 'TOKEN_REFRESHED') {
          dispatch(
            updateCredentials({
              accessToken: event.data.accessToken,
              expiresAt: event.data.expiresAt
            })
          )
        } else if (event.data.type === 'TOKEN_REFRESH_FAILED') {
          dispatch(logout())
        }
      }

      return () => {
        channel.close()
      }
    }
  }, [dispatch])

  // ----------------------------------------------------------------------
  // EFFECT 1: SILENT REFRESH KHI RELOAD TRANG
  // ----------------------------------------------------------------------
  useEffect(() => {
    // Trường hợp 1: Mất token (F5) và chưa thử lấy lại
    if (!accessToken && !hasAttemptedRefresh.current) {
      hasAttemptedRefresh.current = true

      // Try to acquire lock before refreshing
      if (!acquireRefreshLock()) {
        // Another tab is already refreshing, wait for broadcast
        dispatch(setInitialized())
        return
      }

      refreshToken({})
        .unwrap()
        .then((data) => {
          dispatch(
            updateCredentials({
              accessToken: data.accessToken,
              expiresAt: data.expiresAt
            })
          )

          // Broadcast to other tabs
          broadcastChannelRef.current?.postMessage({
            type: 'TOKEN_REFRESHED',
            accessToken: data.accessToken,
            expiresAt: data.expiresAt
          })
        })
        .catch(() => {
          dispatch(logout())

          // Broadcast failure to other tabs
          broadcastChannelRef.current?.postMessage({
            type: 'TOKEN_REFRESH_FAILED'
          })
        })
        .finally(() => {
          releaseRefreshLock()
          // 3. CHỐT HẠ QUAN TRỌNG NHẤT: Báo cho App biết đã check xong, mở cổng!
          dispatch(setInitialized())
        })
    }
    // Trường hợp 2: Đã có token (VD: Vừa login xong) nhưng cờ chưa bật
    else if (accessToken && !isInitialized) {
      dispatch(setInitialized())
    }
    // Trường hợp 3: Vô tình kẹt lại (Đã thử refresh, không có token, nhưng quên bật cờ)
    else if (!accessToken && hasAttemptedRefresh.current && !isInitialized) {
      dispatch(setInitialized())
    }
  }, [accessToken, isInitialized, dispatch, refreshToken]) // Nhớ thêm isInitialized vào dependency

  // ----------------------------------------------------------------------
  // EFFECT 2: PROACTIVE REFRESH (Làm mới token tự động trước khi hết hạn)
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!accessToken || !expiresAt) return

    // Use ref to track current refresh request
    const refreshRequestIdRef = { current: 0 }

    const handleTokenRefresh = async () => {
      // Try to acquire lock before refreshing
      if (!acquireRefreshLock()) {
        // Another tab is already refreshing, skip
        return
      }

      // Increment request ID before starting refresh
      const currentRequestId = ++refreshRequestIdRef.current

      try {
        const data = await refreshToken({}).unwrap()

        // Only update if this is still the latest request
        if (currentRequestId === refreshRequestIdRef.current) {
          dispatch(
            updateCredentials({
              accessToken: data.accessToken,
              expiresAt: data.expiresAt
            })
          )

          // Broadcast to other tabs
          broadcastChannelRef.current?.postMessage({
            type: 'TOKEN_REFRESHED',
            accessToken: data.accessToken,
            expiresAt: data.expiresAt
          })
        }
      } catch {
        // Only logout if this is still the latest request
        if (currentRequestId === refreshRequestIdRef.current) {
          dispatch(logout())

          // Broadcast failure to other tabs
          broadcastChannelRef.current?.postMessage({
            type: 'TOKEN_REFRESH_FAILED'
          })
        }
      } finally {
        releaseRefreshLock()
      }
    }

    const currentTime = Date.now()
    const timeUntilExpiration = expiresAt - currentTime

    if (timeUntilExpiration <= 0) {
      handleTokenRefresh()
    } else {
      const refreshTime = Math.max(timeUntilExpiration - 60 * 1000, 0)
      const timer = setTimeout(handleTokenRefresh, refreshTime)
      return () => {
        clearTimeout(timer)
        // Mark any in-flight request as stale
        refreshRequestIdRef.current++
      }
    }
  }, [accessToken, expiresAt, dispatch, refreshToken])
}

export default useAuthExpiration

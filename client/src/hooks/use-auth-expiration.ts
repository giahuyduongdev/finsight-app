import { useEffect, useRef } from 'react'
import { useAppDispatch, useTypedSelector } from '@/app/hook'
import {
  logout,
  updateCredentials,
  setInitialized
} from '@/features/auth/authSlice'
import { useRefreshMutation } from '@/features/auth/authAPI'

// Shared refresh coordination using BroadcastChannel
const REFRESH_CHANNEL_NAME = 'auth_refresh_channel'
const REFRESH_LOCK_KEY = 'auth_refresh_lock:v1'
const REFRESH_LOCK_TIMEOUT = 5000 // 5 seconds

/**
 * Acquire a best-effort refresh lock via localStorage.
 *
 * NOTE: localStorage is NOT atomic — there is an inherent TOCTOU (time-of-check
 * to time-of-use) race between reading and writing the lock across tabs. In the
 * worst case two tabs may both believe they hold the lock and both call the
 * refresh endpoint simultaneously. This is acceptable: the server is idempotent
 * for token refresh (both requests succeed and the second one's token is simply
 * broadcast back via BroadcastChannel). The lock is a best-effort optimization
 * to reduce redundant requests, not a hard guarantee.
 */
const acquireRefreshLock = (): boolean => {
  const now = Date.now()
  const tabId = crypto.randomUUID()

  try {
    const lockData = localStorage.getItem(REFRESH_LOCK_KEY)

    if (lockData) {
      const { timestamp } = JSON.parse(lockData)
      // If lock is not yet expired, another tab owns it
      if (now - timestamp < REFRESH_LOCK_TIMEOUT) {
        return false
      }
    }

    // Acquire lock with ownership tracking
    localStorage.setItem(
      REFRESH_LOCK_KEY,
      JSON.stringify({ timestamp: now, owner: tabId })
    )

    // Verify we actually got the lock (reduces — but does not eliminate — TOCTOU)
    const verifyLock = localStorage.getItem(REFRESH_LOCK_KEY)
    if (verifyLock) {
      const { owner } = JSON.parse(verifyLock)
      return owner === tabId
    }

    return false
  } catch {
    // If localStorage is unavailable, allow this tab to proceed
    return true
  }
}

// Helper to release refresh lock
const releaseRefreshLock = () => {
  localStorage.removeItem(REFRESH_LOCK_KEY)
}

const useAuthExpiration = () => {
  const { accessToken, expiresAt, isInitialized } = useTypedSelector(
    (state) => state.auth
  )
  // Use userId (primitive string) instead of the whole user object to avoid
  // re-triggering effects on every shallow-copy mutation of the user object.
  const userId = useTypedSelector((state) => state.auth.user?.id ?? null)

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
  // EFFECT 1: SILENT REFRESH ON PAGE RELOAD
  // Runs when accessToken is missing but we know a user was previously
  // logged in (userId is present in persisted state).
  // ----------------------------------------------------------------------
  useEffect(() => {
    // Case 1: Token lost (e.g. page refresh) — attempt silent refresh
    if (!accessToken && !hasAttemptedRefresh.current && userId) {
      hasAttemptedRefresh.current = true

      if (!acquireRefreshLock()) {
        // Another tab is already refreshing — wait for its broadcast
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

          broadcastChannelRef.current?.postMessage({
            type: 'TOKEN_REFRESHED',
            accessToken: data.accessToken,
            expiresAt: data.expiresAt
          })
        })
        .catch(() => {
          dispatch(logout())

          broadcastChannelRef.current?.postMessage({
            type: 'TOKEN_REFRESH_FAILED'
          })
        })
        .finally(() => {
          releaseRefreshLock()
          dispatch(setInitialized())
        })
    }
    // Case 2: Token is present but app not yet initialized (e.g. just logged in)
    else if (accessToken && !isInitialized) {
      dispatch(setInitialized())
    }
    // Case 3: No token, no user → not logged in
    else if (!accessToken && !userId && !isInitialized) {
      dispatch(setInitialized())
    }
    // Case 4: Refresh was attempted but isInitialized flag was never set
    else if (!accessToken && hasAttemptedRefresh.current && !isInitialized) {
      dispatch(setInitialized())
    }
  }, [accessToken, isInitialized, userId, dispatch, refreshToken])

  // ----------------------------------------------------------------------
  // EFFECT 2: PROACTIVE REFRESH (refresh token before it expires)
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!accessToken || !expiresAt) return

    // Track in-flight request ID to discard stale responses
    const refreshRequestIdRef = { current: 0 }

    const handleTokenRefresh = async () => {
      if (!acquireRefreshLock()) {
        // Another tab is already refreshing
        return
      }

      const currentRequestId = ++refreshRequestIdRef.current

      try {
        const data = await refreshToken({}).unwrap()

        if (currentRequestId === refreshRequestIdRef.current) {
          dispatch(
            updateCredentials({
              accessToken: data.accessToken,
              expiresAt: data.expiresAt
            })
          )

          broadcastChannelRef.current?.postMessage({
            type: 'TOKEN_REFRESHED',
            accessToken: data.accessToken,
            expiresAt: data.expiresAt
          })
        }
      } catch {
        if (currentRequestId === refreshRequestIdRef.current) {
          dispatch(logout())

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
      // Token already expired — refresh immediately
      handleTokenRefresh()
    } else {
      // Schedule refresh 60s before expiration
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

import { useEffect, useRef } from 'react'
import { useAppDispatch, useTypedSelector } from '@/app/hook'
// 1. NHỚ IMPORT THÊM setInitialized TỪ authSlice
import {
  logout,
  updateCredentials,
  setInitialized
} from '@/features/auth/authSlice'
import { useRefreshMutation } from '@/features/auth/authAPI'

const useAuthExpiration = () => {
  // 2. LẤY THÊM isInitialized TỪ REDUX
  const { accessToken, expiresAt, isInitialized } = useTypedSelector(
    (state) => state.auth
  )
  const dispatch = useAppDispatch()
  const [refreshToken] = useRefreshMutation()

  const hasAttemptedRefresh = useRef(false)

  // ----------------------------------------------------------------------
  // EFFECT 1: SILENT REFRESH KHI RELOAD TRANG
  // ----------------------------------------------------------------------
  useEffect(() => {
    // Trường hợp 1: Mất token (F5) và chưa thử lấy lại
    if (!accessToken && !hasAttemptedRefresh.current) {
      hasAttemptedRefresh.current = true

      refreshToken({})
        .unwrap()
        .then((data) => {
          dispatch(
            updateCredentials({
              accessToken: data.accessToken,
              expiresAt: data.expiresAt
            })
          )
        })
        .catch(() => {
          dispatch(logout())
        })
        .finally(() => {
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
  // (Phần này giữ nguyên không đổi)
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!accessToken || !expiresAt) return

    // Use ref to track current refresh request
    const refreshRequestIdRef = { current: 0 }

    const handleTokenRefresh = async () => {
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
        }
      } catch {
        // Only logout if this is still the latest request
        if (currentRequestId === refreshRequestIdRef.current) {
          dispatch(logout())
        }
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

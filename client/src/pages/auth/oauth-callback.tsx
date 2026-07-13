import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/app/hook'
import { setCredentials } from '@/features/auth/authSlice'
import { AUTH_ROUTES, PROTECTED_ROUTES } from '@/routes/common/routePath'
import { toast } from 'sonner'
import { useLazyGetMeQuery, useRefreshMutation } from '@/features/auth/authAPI'

const OAuthCallback = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [getMe] = useLazyGetMeQuery()
  const [refresh] = useRefreshMutation()

  useEffect(() => {
    let isActive = true
    let redirectTimeoutId: ReturnType<typeof setTimeout> | undefined

    const syncUserAccount = async () => {
      try {
        const { accessToken, expiresAt } = await refresh(undefined).unwrap()
        const userData = await getMe(accessToken).unwrap()

        if (!isActive) return

        dispatch(
          setCredentials({
            accessToken,
            expiresAt,
            user: userData
          })
        )

        toast.success('Login successful!')

        redirectTimeoutId = setTimeout(() => {
          navigate(PROTECTED_ROUTES.OVERVIEW, { replace: true })
        }, 100)
      } catch {
        if (!isActive) return

        toast.error('Data synchronization failed, please try again!')
        navigate(AUTH_ROUTES.SIGN_IN, { replace: true })
      }
    }

    syncUserAccount()

    return () => {
      isActive = false

      if (redirectTimeoutId) {
        clearTimeout(redirectTimeoutId)
      }
    }
  }, [dispatch, navigate, getMe, refresh])

  // Giao diện chờ xoay xoay mượt mà
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-background">
      <div className="text-center space-y-4" role="status" aria-live="polite">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent mx-auto"
          aria-hidden="true"
        />
        <h2 className="text-xl font-semibold">Synchronizing accounts...</h2>
        <p className="text-sm text-muted-foreground">Please wait a moment</p>
        <span className="sr-only">Loading, please wait</span>
      </div>
    </div>
  )
}

export default OAuthCallback

import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppDispatch } from '@/app/hook'
import { setCredentials } from '@/features/auth/authSlice'
import { AUTH_ROUTES, PROTECTED_ROUTES } from '@/routes/common/routePath'
import { toast } from 'sonner'
import { useLazyGetMeQuery } from '@/features/auth/authAPI' // Import hook gọi API của bạn vào đây

const OAuthCallback = () => {
  const [params] = useSearchParams()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // Khởi tạo hàm gọi API lấy Profile
  const [getMe] = useLazyGetMeQuery()

  useEffect(() => {
    // Phải bọc trong một hàm async vì chúng ta sẽ dùng await để đợi API trả về
    const syncUserAccount = async () => {
      // 1. Lấy Token từ thanh URL
      const accessToken = params.get('accessToken')
      const expiresAt = params.get('expiresAt')

      if (!accessToken || !expiresAt) {
        navigate(AUTH_ROUTES.SIGN_IN, { replace: true })
        return
      }

      try {
        // 2. Dùng Token chộp được gọi API Backend để lấy Profile
        // .unwrap() giúp chúng ta lấy thẳng cục data (chính là response.user nhờ cấu hình transformResponse lúc nãy)
        const userData = await getMe(accessToken).unwrap()

        // 3. Gộp cả Token lẫn User ném vào Redux
        dispatch(
          setCredentials({
            accessToken,
            expiresAt: Number(expiresAt),
            user: userData // Mấu chốt để hệ thống nhận diện bạn đã đăng nhập là đây!
          })
        )

        toast.success('Login successful!')

        // 4. Chuyển hướng vào Dashboard (Để delay 100ms cho Redux kịp lưu state)
        setTimeout(() => {
          navigate(PROTECTED_ROUTES.OVERVIEW, { replace: true })
        }, 100)
      } catch {
        toast.error('Data synchronization failed, please try again!')
        navigate(AUTH_ROUTES.SIGN_IN, { replace: true })
      }
    }

    syncUserAccount()
  }, [params, dispatch, navigate, getMe])

  // Giao diện chờ xoay xoay mượt mà
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-background">
      <div className="text-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent mx-auto" />
        <h2 className="text-xl font-semibold">Synchronizing accounts...</h2>
        <p className="text-sm text-muted-foreground">Please wait a moment.</p>
      </div>
    </div>
  )
}

export default OAuthCallback

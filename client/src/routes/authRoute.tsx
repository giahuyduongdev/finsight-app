import { useTypedSelector } from '@/app/hook'
import { Navigate, Outlet } from 'react-router-dom'
import { PROTECTED_ROUTES } from './common/routePath'

const AuthRoute = () => {
  const { accessToken, user } = useTypedSelector((state) => state.auth)

  // Nếu THIẾU token HOẶC THIẾU user -> Cho phép vào trang Login/Register
  if (!accessToken || !user) {
    return <Outlet />
  }

  // Nếu CÓ CẢ HAI -> Đã đăng nhập rồi, đẩy vào trang trong
  return <Navigate to={PROTECTED_ROUTES.OVERVIEW} replace />
}

export default AuthRoute

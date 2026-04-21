import { useTypedSelector } from '@/app/hook'
import { Navigate, Outlet } from 'react-router-dom'
import { PROTECTED_ROUTES } from './common/routePath'

const AuthRoute = () => {
  const { accessToken, user, isInitialized } = useTypedSelector(
    (state) => state.auth
  )

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        {/* Logo giữa màn hình */}
        <div className="flex flex-col items-center justify-center flex-1">
          {/* Thêm animate-pulse để logo có nhịp thở nhẹ nhàng */}
          <div className="flex items-center gap-2 animate-pulse">
            {/* Đã xóa w-14 h-14, để SVG tự scale theo width/height thật */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="100" // Kích thước chuẩn cho logo giữa màn hình
              height="100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00bc7d" // Đổi một chút sang màu xanh Finsight chuẩn
              strokeWidth="2.5" // Đổi thành camelCase cho chuẩn React
              strokeLinecap="round" // Đổi thành camelCase
              strokeLinejoin="round" // Đổi thành camelCase
              className="lucide lucide-gallery-vertical-end"
            >
              <path d="M7 2h10" />
              <path d="M5 6h14" />
              <rect width="18" height="12" x="3" y="10" rx="2" />
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div className="pb-10 flex flex-col items-center gap-1">
          {/* text-xs -> text-sm */}
          <p className="text-sm text-muted-foreground">from</p>
          {/* text-sm -> text-xl, thêm uppercase và tracking-widest cho chuẩn nhận diện thương hiệu */}
          <p className="text-xl font-bold text-foreground tracking-widest uppercase">
            Finsight
          </p>
        </div>
      </div>
    )
  }

  // Nếu THIẾU token HOẶC THIẾU user -> Cho phép vào trang Login/Register
  if (!accessToken || !user) {
    return <Outlet />
  }

  // Nếu CÓ CẢ HAI -> Đã đăng nhập rồi, đẩy vào trang trong
  return <Navigate to={PROTECTED_ROUTES.OVERVIEW} replace />
}

export default AuthRoute

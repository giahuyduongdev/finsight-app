import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { authenticationRoutePaths, protectedRoutePaths } from './common/routes'
import AppLayout from '@/layouts/app-layout'
import BaseLayout from '@/layouts/base-layout'
import AuthRoute from './authRoute'
import ProtectedRoute from './protectedRoute'
import useAuthExpiration from '@/hooks/use-auth-expiration'
import { APP_NAVIGATION_EVENT } from '@/lib/navigation'

function AppNavigationBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const { to } = (event as CustomEvent<{ to?: string }>).detail || {}
      if (to) navigate(to)
    }

    window.addEventListener(APP_NAVIGATION_EVENT, handleNavigate)

    return () => {
      window.removeEventListener(APP_NAVIGATION_EVENT, handleNavigate)
    }
  }, [navigate])

  return null
}

function AppRoutes() {
  useAuthExpiration()
  return (
    <BrowserRouter>
      <AppNavigationBridge />
      <Routes>
        <Route path="/" element={<AuthRoute />}>
          <Route element={<BaseLayout />}>
            {authenticationRoutePaths.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={route.element}
              />
            ))}
          </Route>
        </Route>
        {/* Protected Route */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {protectedRoutePaths.map((route) => (
              <Route key={route.path} path={route.path} element={route.element}>
                {route.children?.map((childRoute) => (
                  <Route
                    key={childRoute.path || 'index'}
                    index={childRoute.index}
                    path={childRoute.path}
                    element={childRoute.element}
                  />
                ))}
              </Route>
            ))}
          </Route>
        </Route>

        {/* Catch-all for undefined routes */}
        <Route path="*" element={<>404</>} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRoutes

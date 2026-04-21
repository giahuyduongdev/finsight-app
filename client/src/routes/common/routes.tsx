import { AUTH_ROUTES, PROTECTED_ROUTES } from './routePath'
import SignIn from '@/pages/auth/sign-in'
import SignUp from '@/pages/auth/sign-up'
import OAuthCallback from '@/pages/auth/oauth-callback'
import Dashboard from '@/pages/dashboard'
import Transactions from '@/pages/transactions'
import Rates from '@/pages/rates'
import Reports from '@/pages/reports'
import Settings from '@/pages/settings'
import Account from '@/pages/settings/account'
import Appearance from '@/pages/settings/appearance'
import Billing from '@/pages/settings/billing'
import Security from '@/pages/settings/security'
import ForgotPassword from '@/pages/auth/forgot-password'

export const authenticationRoutePaths = [
  { path: AUTH_ROUTES.SIGN_IN, element: <SignIn /> },
  { path: AUTH_ROUTES.SIGN_UP, element: <SignUp /> },
  { path: AUTH_ROUTES.FORGOT_PASSWORD, element: <ForgotPassword /> },
  { path: AUTH_ROUTES.OAUTH_CALLBACK, element: <OAuthCallback /> }
]

export const protectedRoutePaths = [
  { path: PROTECTED_ROUTES.OVERVIEW, element: <Dashboard /> },
  { path: PROTECTED_ROUTES.TRANSACTIONS, element: <Transactions /> },
  { path: PROTECTED_ROUTES.RATES, element: <Rates /> },
  { path: PROTECTED_ROUTES.REPORTS, element: <Reports /> },
  {
    path: PROTECTED_ROUTES.SETTINGS,
    element: <Settings />,
    children: [
      { index: true, element: <Account /> }, // Default route
      { path: PROTECTED_ROUTES.SETTINGS, element: <Account /> },
      { path: PROTECTED_ROUTES.SETTINGS_APPEARANCE, element: <Appearance /> },
      { path: PROTECTED_ROUTES.SETTINGS_BILLING, element: <Billing /> },
      { path: PROTECTED_ROUTES.SETTINGS_SECURITY, element: <Security /> }
    ]
  }
]

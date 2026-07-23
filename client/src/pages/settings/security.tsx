import { Separator } from '@/components/ui/separator'
import { ChangePasswordDialog } from './_components/change-password-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LogOut, Loader } from 'lucide-react'
import { useState } from 'react'
import { useLogoutAllMutation } from '@/features/auth/authAPI'
import { useAppDispatch } from '@/app/hook'
import { logout } from '@/features/auth/authSlice'
import { apiClient } from '@/app/api-client'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '@/routes/common/routePath'

const isLogoutAllAuthError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  error.status === 401

const isSuccessfulLogoutAllFallback = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'originalStatus' in error &&
  error.originalStatus === 200

const Security = () => {
  const [isLogoutAllOpen, setIsLogoutAllOpen] = useState(false)
  const [logoutAll, { isLoading }] = useLogoutAllMutation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const handleLogoutAll = async () => {
    try {
      await logoutAll({}).unwrap()
      toast.success('Logged out from all devices')
    } catch (error) {
      toast.success(
        isSuccessfulLogoutAllFallback(error) || isLogoutAllAuthError(error)
          ? 'Logged out from all devices'
          : 'Logged out from this browser'
      )
    } finally {
      dispatch(logout())
      dispatch(apiClient.util.resetApiState())
      setIsLogoutAllOpen(false)
      localStorage.removeItem('persist:root')
      navigate(AUTH_ROUTES.SIGN_IN)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Security</h3>
        <p className="text-sm text-muted-foreground">
          Manage your account security and password settings.
        </p>
      </div>
      <Separator />
      <div className="flex flex-col items-start gap-4 pb-10">
        <div className="space-y-1">
          <p className="text-sm font-medium">Change Password</p>
          <p className="text-xs text-muted-foreground">
            We'll send a verification code to your email to confirm this change.
          </p>
        </div>
        <ChangePasswordDialog />
      </div>
      <Separator />
      <div className="flex flex-col items-start gap-4 pb-10">
        <div className="space-y-1">
          <p className="text-sm font-medium">Log out all devices</p>
          <p className="text-xs text-muted-foreground">
            End every active session for this account, including other browsers
            and devices.
          </p>
        </div>
        <Dialog open={isLogoutAllOpen} onOpenChange={setIsLogoutAllOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" type="button">
              <LogOut className="h-4 w-4" />
              Log out all devices
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log out all devices?</DialogTitle>
              <DialogDescription>
                This will sign you out on every active browser and device. You
                will need to sign in again to continue.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={isLoading}
                onClick={() => setIsLogoutAllOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                type="button"
                disabled={isLoading}
                onClick={handleLogoutAll}
              >
                {isLoading && <Loader className="h-4 w-4 animate-spin" />}
                Log out all
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default Security

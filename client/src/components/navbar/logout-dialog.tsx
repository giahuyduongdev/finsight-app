import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { DialogContent, DialogDescription } from '@/components/ui/dialog'
import { Loader } from 'lucide-react'
import { Button } from '../ui/button'
import { useTransition } from 'react'
import { useAppDispatch } from '@/app/hook'
import { logout } from '@/features/auth/authSlice'
import { useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '@/routes/common/routePath'
import { useLogoutMutation } from '@/features/auth/authAPI'
import { toast } from 'sonner'
import { apiClient } from '@/app/api-client'
import { publishLocalLogout } from '@/lib/local-logout-sync'

interface LogoutDialogProps {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
}

const LogoutDialog = ({ isOpen, setIsOpen }: LogoutDialogProps) => {
  const [isPending] = useTransition()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [logoutApi] = useLogoutMutation()

  const handleLogout = async () => {
    try {
      // 3. Gọi API lên server (để server xóa Cookie/Session)
      // Dùng .unwrap() để bắt lỗi nếu có
      await logoutApi({}).unwrap()
      toast.success('Logged out successfully')
    } catch {
      // Dù API lỗi vẫn nên cho logout ở máy khách để đảm bảo an toàn
      toast.error('Server error, but cleaning up session')
    } finally {
      // 4. Dọn dẹp Redux và chuyển trang
      dispatch(logout())
      dispatch(apiClient.util.resetApiState())
      publishLocalLogout()
      setIsOpen(false)
      navigate(AUTH_ROUTES.SIGN_IN)

      localStorage.removeItem('persist:root')
    }
  }
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure you want to log out?</DialogTitle>
          <DialogDescription>
            This will end your current session and you will need to log in again
            to access your account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="text-white bg-red-500 hover:bg-red-600"
            disabled={isPending}
            type="button"
            onClick={handleLogout}
          >
            {isPending && <Loader className="animate-spin" />}
            Yes, Log Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default LogoutDialog

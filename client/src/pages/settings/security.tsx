import { Separator } from "@/components/ui/separator"
import { ChangePasswordDialog } from "./_components/change-password-dialog"

const Security = () => {
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
    </div>
  )
}

export default Security

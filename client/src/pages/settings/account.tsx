import { Separator } from '@/components/ui/separator'
import { AccountForm } from './_components/account-form'
import { ChangeEmailDialog } from './_components/change-email-dialog'

const Account = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Account</h3>
          <p className="text-sm text-muted-foreground">
            Update your account settings.
          </p>
        </div>
        <ChangeEmailDialog />
      </div>
      <Separator />
      <AccountForm />
    </div>
  )
}

export default Account

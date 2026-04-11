import { Separator } from '@/components/ui/separator'

const Billing = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing</h3>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing information.
        </p>
      </div>
      <Separator />

      <div className="w-full">
        <div className="rounded-lg border border-dashed p-6 space-y-4">
          {/* Badge */}
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            Beta Version — Free Access
          </div>

          <div>
            <h1 className="text-lg font-medium mb-1">Free During Beta</h1>
            <p className="text-sm text-muted-foreground">
              You are currently on the <strong>Beta</strong> version of
              Finsight. All features are completely <strong>free</strong> during
              this period. No credit card required.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <h2 className="text-sm font-medium">Coming Soon</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                Free & Pro plans with feature limits
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                Payments — Monthly & Yearly billing
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                Manage & cancel subscription anytime
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                Billing history & invoices
              </li>
            </ul>
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground">
            We will notify you before transitioning to the full release. Your
            data will remain safe and intact.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Billing

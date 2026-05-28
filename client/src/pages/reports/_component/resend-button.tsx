import { Button } from '@/components/ui/button'
import { Loader, RefreshCw } from 'lucide-react'
import { useResendReportMutation } from '@/features/report/reportAPI'
import { toast } from 'sonner'

const ResendButton = ({ reportId }: { reportId: string }) => {
  const [resendReport, { isLoading }] = useResendReportMutation()

  const handleResend = () => {
    resendReport(reportId)
      .unwrap()
      .then(() => toast.success('Report resent successfully'))
      .catch((error) =>
        toast.error(error.data?.message || 'Failed to resend report')
      )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="font-normal"
      onClick={handleResend}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Resend
    </Button>
  )
}

export default ResendButton

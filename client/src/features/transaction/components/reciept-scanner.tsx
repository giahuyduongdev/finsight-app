import { ChangeEvent } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScanText } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface ReceiptScannerProps {
  loadingChange: boolean
  receipt: string | null
  progress: number
  onReceiptUpload: (event: ChangeEvent<HTMLInputElement>) => void
}

const ReceiptPreview = ({ receipt }: { receipt: string | null }) => (
  <div
    className={`h-12 w-12 rounded-md border bg-cover bg-center ${
      !receipt ? 'bg-muted' : ''
    }`}
    style={receipt ? { backgroundImage: `url(${receipt})` } : {}}
    role="img"
    aria-label={receipt ? 'Receipt preview' : 'No receipt uploaded'}
  >
    {!receipt && (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <ScanText color="currentColor" className="h-5 w-5 !stroke-1.5" />
      </div>
    )}
  </div>
)

const ReceiptUploadInput = ({
  disabled,
  onReceiptUpload
}: {
  disabled: boolean
  onReceiptUpload: (event: ChangeEvent<HTMLInputElement>) => void
}) => (
  <>
    <Input
      type="file"
      accept="image/*"
      onChange={onReceiptUpload}
      aria-label="Upload receipt image"
      aria-describedby="receipt-file-restrictions"
      className="max-w-[250px] px-1 h-9 cursor-pointer file:cursor-pointer text-sm file:mr-2
            file:rounded file:border-0 file:bg-primary file:px-3 file:py-px
             file:text-sm file:font-medium file:text-white
             hover:file:bg-primary/90"
      disabled={disabled}
    />
    <p
      id="receipt-file-restrictions"
      className="mt-2 text-[11px] px-2 text-muted-foreground"
    >
      JPG, PNG up to 5MB
    </p>
  </>
)

const ReceiptScanProgress = ({ progress }: { progress: number }) => (
  <div className="space-y-2 pt-3" role="status" aria-live="polite">
    <Progress value={progress} className="h-2 w-[250px]" />
    <p className="text-xs text-muted-foreground" aria-atomic="true">
      Scanning receipt... {progress}%
    </p>
  </div>
)

const ReceiptScanner = ({
  loadingChange,
  receipt,
  progress,
  onReceiptUpload
}: ReceiptScannerProps) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">AI Scan Receipt</Label>
      <div className="flex items-start gap-3 border-b pb-4">
        <ReceiptPreview receipt={receipt} />
        <div className="flex-1">
          {!loadingChange ? (
            <ReceiptUploadInput
              disabled={loadingChange}
              onReceiptUpload={onReceiptUpload}
            />
          ) : (
            <ReceiptScanProgress progress={progress} />
          )}
        </div>
      </div>
    </div>
  )
}

export default ReceiptScanner

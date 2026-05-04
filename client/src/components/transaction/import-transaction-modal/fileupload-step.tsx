import { toast } from 'sonner'
import { usePapaParse } from 'react-papaparse'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useRef } from 'react'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { MAX_FILE_SIZE, MAX_IMPORT_LIMIT } from '@/constant'
import { useProgressLoader } from '@/hooks/use-progress-loader'

interface CsvRow {
  [key: string]: string | undefined // Define that rows can be indexed with strings
}

type FileUploadStepProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFileUpload: (file: File, columns: any[], data: any[]) => void
}

const FileUploadStep = ({ onFileUpload }: FileUploadStepProps) => {
  const { readString } = usePapaParse()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    progress,
    isLoading,
    startProgress,
    updateProgress,
    doneProgress,
    resetProgress
  } = useProgressLoader({ initialProgress: 10, completionDelay: 500 })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `File size exceeds the limit of ${MAX_FILE_SIZE / 1024 / 1024} MB`
      )
      return
    }
    resetProgress() // Clear any previous progress
    startProgress()

    try {
      // First read the file as text
      const fileText = await file.text()
      // Then parse the CSV text
      readString<CsvRow>(fileText, {
        header: true,
        skipEmptyLines: true,
        fastMode: true,
        complete: (results) => {
          if (results.data.length > MAX_IMPORT_LIMIT) {
            toast.error(
              `You can only import up to ${MAX_IMPORT_LIMIT} transactions.`
            )
            resetProgress()
            return
          }

          updateProgress(40)

          const columns =
            results.meta.fields?.map((name: string) => ({
              id: name,
              name,
              sampleData:
                results.data[0]?.[name]?.slice(0, MAX_IMPORT_LIMIT) || ''
            })) || []

          doneProgress()

          setTimeout(() => {
            onFileUpload(file, columns, results.data)
          }, 500)
        },
        error: (error) => {
          toast.error(`Failed to parse CSV: ${error.message}`)
          resetProgress()
        }
      })
    } catch {
      resetProgress()
    }
  }

  return (
    <div className="flex flex-col gap-6 h-full py-4">
      <DialogHeader>
        <DialogTitle>Upload CSV File</DialogTitle>
        <DialogDescription>
          Select a CSV file containing your transaction data
        </DialogDescription>
      </DialogHeader>

      <div
        className="flex-1 flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-muted/50 transition-colors px-10 py-16 min-h-[250px]"
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv"
          className="hidden"
        />

        <Button
          size="lg"
          className="!bg-[var(--secondary-dark-color)] text-white min-w-44"
          disabled={isLoading}
        >
          <FileUp className="w-6.5 h-6.5" />
          Select File
        </Button>

        {fileInputRef.current?.files?.[0] ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Selected: {fileInputRef.current?.files?.[0].name}
          </p>
        ) : (
          <div className="text-xs text-muted-foreground mt-3">
            Maximum file size: 5MB
          </div>
        )}

        {isLoading && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Parsing file... {progress}%
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FileUploadStep

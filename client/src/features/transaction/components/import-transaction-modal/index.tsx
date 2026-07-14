import { useState } from 'react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ImportIcon } from 'lucide-react'
import FileUploadStep from './fileupload-step'
import ColumnMappingStep from './column-mapping-step'
import { CsvColumn, TransactionField } from '@/@types/transaction.type'
import ConfirmationStep from './confirmation-step'
import { cn } from '@/lib/utils'

const transactionFields: TransactionField[] = [
  { fieldName: 'title', required: true },
  { fieldName: 'amount', required: true },
  { fieldName: 'currency', required: false },
  { fieldName: 'type', required: true },
  { fieldName: 'date', required: true },
  { fieldName: 'category', required: true },
  { fieldName: 'paymentMethod', required: true },
  { fieldName: 'status', required: false },
  { fieldName: 'description', required: false }
]

type ImportStep = 1 | 2 | 3

type ImportState = {
  step: ImportStep
  csvColumns: CsvColumn[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  csvData: any[]
  mappings: Record<string, string>
  open: boolean
}

const initialImportState: ImportState = {
  step: 1,
  csvColumns: [],
  csvData: [],
  mappings: {},
  open: false
}

const ImportTransactionModal = () => {
  const [importState, setImportState] =
    useState<ImportState>(initialImportState)
  const { step, csvColumns, csvData, mappings, open } = importState

  // console.log(transactionFields, file, csvColumns, csvData, mappings);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFileUpload = (_file: File, columns: CsvColumn[], data: any[]) => {
    setImportState({
      open,
      step: 2,
      csvColumns: columns,
      csvData: data,
      mappings: {}
    })
  }

  const handleClose = () => {
    setImportState({
      ...importState,
      open: false
    })
  }

  const handleMappingComplete = (nextMappings: Record<string, string>) => {
    setImportState({
      ...importState,
      step: 3,
      mappings: nextMappings
    })
  }

  const handleBack = (nextStep: ImportStep) => {
    setImportState({
      ...importState,
      step: nextStep
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setImportState({
        ...importState,
        open: true
      })
      return
    }

    setImportState(initialImportState)
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return <FileUploadStep onFileUpload={handleFileUpload} />
      case 2:
        return (
          <ColumnMappingStep
            csvColumns={csvColumns}
            mappings={mappings}
            transactionFields={transactionFields}
            onComplete={handleMappingComplete}
            onBack={() => handleBack(1)}
          />
        )
      case 3:
        return (
          <ConfirmationStep
            mappings={mappings}
            csvData={csvData}
            onBack={() => handleBack(2)}
            onComplete={() => handleClose()}
          />
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="!shadow-none !cursor-pointer !border-gray-500 !text-white !bg-transparent"
          aria-label="Open bulk import modal"
        >
          <ImportIcon className="!w-5 !h-5" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          'min-h-[40vh] transition-[max-width] duration-300',
          step === 3 ? 'sm:max-w-6xl' : 'sm:max-w-lg'
        )}
      >
        {renderStep()}
      </DialogContent>
    </Dialog>
  )
}

export default ImportTransactionModal

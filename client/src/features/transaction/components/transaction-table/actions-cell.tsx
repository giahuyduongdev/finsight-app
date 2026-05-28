import { Copy, Loader, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import useEditTransactionDrawer from '@/hooks/use-edit-transaction-drawer'
import {
  useDeleteTransactionMutation,
  useDuplicateTransactionMutation
} from '@/features/transaction/transactionAPI'
import { toast } from 'sonner'
import { TransactionType } from '@/features/transaction/transactionType'
import { Row } from '@tanstack/react-table'

// Định nghĩa kiểu mở rộng để tránh lỗi ESLint "any" cho các biến ảo/biến mới
type ExtendedTransaction = TransactionType & {
  recurringSourceId?: string | null
  _rowType?: string
}

const ActionsCell = ({ row }: { row: Row<TransactionType> }) => {
  const transactionId = row.original._id
  const { onOpenDrawer } = useEditTransactionDrawer()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const [duplicateTransaction, { isLoading: isDuplicating }] =
    useDuplicateTransactionMutation()
  const [deleteTransaction, { isLoading: isDeleting }] =
    useDeleteTransactionMutation()

  // Ép kiểu an toàn để truy cập recurringSourceId và _rowType mà không dùng "any"
  const tx = row.original as ExtendedTransaction

  // Kiểm tra nếu là giao dịch con (sinh ra từ chu kỳ lặp)
  const isChild = !!tx.recurringSourceId || tx._rowType === 'child'

  const handleDuplicate = (e: Event) => {
    e.preventDefault()
    // Chặn duplicate nếu đang xử lý hoặc nếu là giao dịch con
    if (isDuplicating || isChild) return

    duplicateTransaction(transactionId)
      .unwrap()
      .then(() => toast.success('Transaction duplicated successfully'))
      .catch((error) =>
        toast.error(error.data?.message || 'Failed to duplicate transaction')
      )
  }

  const handleDeleteConfirm = () => {
    if (isDeleting) return

    deleteTransaction(transactionId)
      .unwrap()
      .then(() => {
        toast.success('Transaction deleted successfully')
        setIsDeleteDialogOpen(false)
      })
      .catch((error) =>
        toast.error(error.data?.message || 'Failed to delete transaction')
      )
  }

  return (
    <>
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Transaction?"
        description="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label="Transaction actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-44"
          align="end"
          onCloseAutoFocus={(e) => {
            if (isDeleting || isDuplicating) e.preventDefault()
          }}
        >
          <DropdownMenuItem onClick={() => onOpenDrawer(transactionId)}>
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            className="relative"
            // KHÓA NÚT: Duplicate bị vô hiệu hóa nếu là giao dịch con
            disabled={isDuplicating || isChild}
            onSelect={handleDuplicate}
          >
            <Copy className="mr-1 h-4 w-4" /> Duplicate
            {isDuplicating && (
              <Loader className="ml-1 h-4 w-4 absolute right-2 animate-spin" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="relative !text-destructive"
            disabled={isDeleting}
            onSelect={(e) => {
              e.preventDefault()
              setIsDeleteDialogOpen(true)
            }}
          >
            <Trash2 className="mr-1 h-4 w-4 !text-destructive" /> Delete
            {isDeleting && (
              <Loader className="ml-1 h-4 w-4 absolute right-2 animate-spin" />
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export default ActionsCell

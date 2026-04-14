import { Router } from 'express'
import {
  createTransactionController,
  duplicateTransactionController,
  getAllTransactionByIdController,
  getAllTransactionController,
  updateTransactionController,
  deleteTransactionController,
  bulkDeleteTransactionController,
  bulkTransactionController,
  scanReceiptController,
  getChildTransactionsController
} from '../controllers/transaction.controller'
import { upload } from '../config/cloudinary.config'

const transactionRoutes = Router()

transactionRoutes.post('/create', createTransactionController)

transactionRoutes.post(
  '/scan-receipt',
  upload.single('receipt'),
  scanReceiptController
)

transactionRoutes.post('/bulk-transaction', bulkTransactionController)

transactionRoutes.put('/duplicate/:id', duplicateTransactionController)
transactionRoutes.put('/update/:id', updateTransactionController)

transactionRoutes.get('/all', getAllTransactionController)
transactionRoutes.get('/:id/children', getChildTransactionsController)
transactionRoutes.get('/:id', getAllTransactionByIdController)
transactionRoutes.delete('/delete/:id', deleteTransactionController)
transactionRoutes.delete('/bulk-delete', bulkDeleteTransactionController)

export default transactionRoutes

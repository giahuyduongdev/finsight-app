import { Router } from 'express'
import {
  createTransactionController,
  duplicateTransactionController,
  getTransactionByIdController,
  getAllTransactionController,
  updateTransactionController,
  deleteTransactionController,
  bulkDeleteTransactionController,
  bulkTransactionController,
  scanReceiptController,
  getChildTransactionsController,
  triggerRecurringTestController
} from '../controllers/transaction.controller'
import { upload } from '../config/cloudinary.config'

const transactionRoutes = Router()

transactionRoutes.post(
  '/test/trigger-recurring',
  triggerRecurringTestController
)
transactionRoutes.post('/', createTransactionController)

transactionRoutes.post(
  '/scan-receipt',
  upload.single('receipt'),
  scanReceiptController
)

transactionRoutes.post('/bulk', bulkTransactionController)

transactionRoutes.post('/:id/duplicate', duplicateTransactionController)
transactionRoutes.put('/:id', updateTransactionController)

transactionRoutes.get('/all', getAllTransactionController)
transactionRoutes.get('/:id/children', getChildTransactionsController)
transactionRoutes.get('/:id', getTransactionByIdController)
transactionRoutes.delete('/bulk', bulkDeleteTransactionController)
transactionRoutes.delete('/:id', deleteTransactionController)

export default transactionRoutes

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
  getChildTransactionsController
} from '../../controllers/transaction.controller'
import { uploadMemory } from '../../config/cloudinary.config'
import { validate } from '../../middlewares/validate.middleware'
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionIdSchema,
  bulkDeleteTransactionSchema,
  bulkTransactionSchema
} from '../../validators/transaction.validator'

const transactionRoutes = Router()

transactionRoutes.post(
  '/',
  validate(createTransactionSchema, 'body'),
  createTransactionController
)
transactionRoutes.post(
  '/scan-receipt',
  uploadMemory.single('receipt'),
  scanReceiptController
)
transactionRoutes.post(
  '/bulk',
  validate(bulkTransactionSchema, 'body'),
  bulkTransactionController
)
transactionRoutes.post(
  '/:id/duplicate',
  validate(transactionIdSchema, 'params'),
  duplicateTransactionController
)
transactionRoutes.put(
  '/:id',
  validate(transactionIdSchema, 'params'),
  validate(updateTransactionSchema, 'body'),
  updateTransactionController
)
transactionRoutes.get('/all', getAllTransactionController)
transactionRoutes.get(
  '/:id/children',
  validate(transactionIdSchema, 'params'),
  getChildTransactionsController
)
transactionRoutes.get(
  '/:id',
  validate(transactionIdSchema, 'params'),
  getTransactionByIdController
)
transactionRoutes.delete(
  '/bulk',
  validate(bulkDeleteTransactionSchema, 'body'),
  bulkDeleteTransactionController
)
transactionRoutes.delete(
  '/:id',
  validate(transactionIdSchema, 'params'),
  deleteTransactionController
)

export default transactionRoutes

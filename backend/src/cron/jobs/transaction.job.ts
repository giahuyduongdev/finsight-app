import mongoose from 'mongoose'
import TransactionModel, {
  TransactionStatusEnum
} from '../../models/transaction.model'
import { calculateNextOccurrence } from '../../utils/dates/index'
import { logger } from '../../config/logger.config'
import { format } from 'date-fns'

export const processRecurringTransactions = async () => {
  const now = new Date()
  let processedCount = 0
  let failedCount = 0

  logger.info('🚀 Starting recurring process')

  try {
    const transactionCursor = TransactionModel.find({
      isRecurring: true,
      nextRecurringDate: { $lte: now }
    }).cursor()

    // Khởi tạo session ở ngoài để tối ưu hiệu năng DB
    const session = await mongoose.startSession()

    try {
      for await (const tx of transactionCursor) {
        const nextDate = calculateNextOccurrence(
          tx.nextRecurringDate!,
          tx.recurringInterval!
        )

        try {
          await session.withTransaction(
            async () => {
              // 1. Tạo child transaction (Giao dịch con / Bản sao thực tế)
              await TransactionModel.create(
                [
                  {
                    ...tx.toObject(),
                    _id: new mongoose.Types.ObjectId(),
                    title: `${tx.title} - ${format(tx.nextRecurringDate!, 'MMM yyyy')}`,
                    date: tx.nextRecurringDate,

                    isRecurring: false, // Con thì không tự lặp lại nữa
                    recurringSourceId: tx._id, // Trỏ về ID của giao dịch gốc (Cha)
                    status: TransactionStatusEnum.PENDING, // Đánh dấu là khoản nợ cần thanh toán

                    // Reset các thông số cấu hình của bản sao
                    nextRecurringDate: null,
                    recurringInterval: null,
                    lastProcessed: null,
                    createdAt: undefined,
                    updatedAt: undefined
                  }
                ],
                { session }
              )

              // 2. Cập nhật parent transaction (Đẩy ngày tính toán sang chu kỳ sau)
              await TransactionModel.updateOne(
                { _id: tx._id },
                {
                  $set: {
                    nextRecurringDate: nextDate,
                    lastProcessed: now
                  }
                },
                { session }
              )
            },
            { maxCommitTimeMS: 20000 }
          )

          processedCount++
        } catch (error: any) {
          failedCount++
          logger.error(`Failed recurring tx: ${tx._id}`, {
            error: error?.message,
            txId: tx._id
          })

          // 🚨 Xử lý "Poison Pill": Tạm ngưng giao dịch nếu bị lỗi để tránh lặp vô tận
          try {
            await TransactionModel.updateOne(
              { _id: tx._id },
              {
                $set: {
                  isRecurring: false,
                  lastProcessed: now
                }
              }
            )
            logger.info(
              `⏸️ The recurring transaction has been temporarily suspended due to an error: ${tx._id}`
            )
          } catch (updateError: any) {
            logger.error(
              `CRITICAL: CRITICAL: Transaction cannot be paused due to error ${tx._id}`,
              {
                error: updateError?.message
              }
            )
          }
        }
      }
    } finally {
      // Đóng session MỘT LẦN DUY NHẤT sau khi vòng lặp kết thúc
      await session.endSession()
    }

    logger.info(`✅ Processed: ${processedCount} transaction`)

    if (failedCount > 0) {
      logger.warn(`⚠️ Failed: ${failedCount} transaction`)
    }

    return {
      success: true,
      processedCount,
      failedCount
    }
  } catch (error: any) {
    logger.error('Error occurred processing transaction', {
      error: error?.message
    })

    return {
      success: false,
      error: error?.message
    }
  }
}

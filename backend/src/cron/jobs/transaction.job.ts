import mongoose from 'mongoose'
import TransactionModel from '../../models/transaction.model'
import { calculateNextOccurrence } from '../../utils/dates/index'
import { logger } from '../../config/logger.config'

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

    // Khởi tạo session ở ngoài
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
              // 1. Tạo child transaction
              await TransactionModel.create(
                [
                  {
                    ...tx.toObject(),
                    _id: new mongoose.Types.ObjectId(),
                    title: `Recurring - ${tx.title}`,
                    date: tx.nextRecurringDate,
                    isRecurring: false,
                    nextRecurringDate: null,
                    recurringInterval: null,
                    lastProcessed: null,
                    createdAt: undefined,
                    updatedAt: undefined
                  }
                ],
                { session }
              )

              // 2. Cập nhật parent transaction
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
        }
      }
    } finally {
      // Đóng session MỘT LẦN DUY NHẤT sau khi vòng lặp chạy xong toàn bộ
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

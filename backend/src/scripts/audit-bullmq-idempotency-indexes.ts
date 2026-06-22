import mongoose from 'mongoose'
import { mongoConfig } from '../config/db.config'
import { logger } from '../config/logger.config'
import ReportModel from '../models/report.model'
import TransactionModel from '../models/transaction.model'

type DuplicateOccurrence = {
  _id: {
    recurringSourceId: mongoose.Types.ObjectId
    date: Date
  }
  count: number
}

export const auditBullMQIdempotencyIndexes = async (): Promise<void> => {
  const duplicateOccurrences =
    await TransactionModel.aggregate<DuplicateOccurrence>([
      {
        $match: {
          recurringSourceId: { $type: 'objectId' }
        }
      },
      {
        $group: {
          _id: {
            recurringSourceId: '$recurringSourceId',
            date: '$date'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      { $limit: 20 }
    ])

  if (duplicateOccurrences.length > 0) {
    logger.error(
      '[APP:Scripts] Duplicate recurring occurrences block unique index creation',
      {
        duplicateCount: duplicateOccurrences.length,
        samples: duplicateOccurrences.map((duplicate) => ({
          recurringSourceId: duplicate._id.recurringSourceId.toString(),
          date: duplicate._id.date.toISOString(),
          count: duplicate.count
        }))
      }
    )
    throw new Error('Duplicate recurring occurrences require manual resolution')
  }

  await Promise.all([
    TransactionModel.createIndexes(),
    ReportModel.createIndexes()
  ])

  logger.info('[APP:Scripts] BullMQ idempotency index audit completed')
}

if (require.main === module) {
  mongoose
    .connect(mongoConfig.uri, mongoConfig.options)
    .then(() => auditBullMQIdempotencyIndexes())
    .catch((error) => {
      logger.error('[APP:Scripts] BullMQ idempotency index audit failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      process.exitCode = 1
    })
    .finally(async () => {
      await mongoose.disconnect()
    })
}

import mongoose from 'mongoose'
import { mongoConfig } from '../config/db.config'
import { logger } from '../config/logger.config'
import UserModel from '../models/user.model'

const run = async (): Promise<void> => {
  await mongoose.connect(mongoConfig.uri, mongoConfig.options)

  const result = await UserModel.updateMany(
    { tokenVersion: { $exists: false } },
    { $set: { tokenVersion: 0 } }
  )

  logger.info('[APP:Scripts] Token version backfill completed', {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount
  })
}

run()
  .catch((error) => {
    logger.error('[APP:Scripts] Token version backfill failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })

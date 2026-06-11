import mongoose from 'mongoose'
import { mongoConfig } from '../config/db.config'
import { logger } from '../config/logger.config'
import UserModel from '../models/user.model'

const run = async (): Promise<void> => {
  await mongoose.connect(mongoConfig.uri, mongoConfig.options)

  const result = await UserModel.updateMany(
    { timezone: 'Asia/Saigon' },
    { $set: { timezone: 'Asia/Ho_Chi_Minh' } }
  )

  logger.info('[APP:Scripts] Timezone normalization completed', {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount
  })
}

run()
  .catch((error) => {
    logger.error('[APP:Scripts] Timezone normalization failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })

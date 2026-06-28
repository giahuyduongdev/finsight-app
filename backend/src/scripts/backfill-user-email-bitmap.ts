import 'dotenv/config'
import mongoose from 'mongoose'
import { mongoConfig } from '../config/db.config'
import { logger } from '../config/logger.config'
import { redis, RedisDatabase } from '../databases/redis.database'
import UserModel from '../models/user.model'
import {
  AUTH_USER_LOOKUP_KEYS,
  clearUserEmailBitmapReady,
  getUserEmailBitmapIndex,
  markUserEmailBitmapReady
} from '../utils/auth-user-lookup.util'

const PIPELINE_BATCH_SIZE = 1000

const run = async (): Promise<void> => {
  await mongoose.connect(mongoConfig.uri, mongoConfig.options)

  await clearUserEmailBitmapReady()
  await redis.del(AUTH_USER_LOOKUP_KEYS.USER_EMAIL_BITMAP)

  const cursor = UserModel.find({}, { email: 1 }).lean().cursor()
  let processedCount = 0
  let pipeline = redis.pipeline()

  for await (const user of cursor) {
    if (!user.email) continue

    pipeline.setbit(
      AUTH_USER_LOOKUP_KEYS.USER_EMAIL_BITMAP,
      getUserEmailBitmapIndex(user.email),
      1
    )
    processedCount += 1

    if (processedCount % PIPELINE_BATCH_SIZE === 0) {
      await pipeline.exec()
      pipeline = redis.pipeline()
    }
  }

  await pipeline.exec()
  await markUserEmailBitmapReady()

  logger.info('[APP:Scripts] User email bitmap backfill completed', {
    processedCount,
    bitmapKey: AUTH_USER_LOOKUP_KEYS.USER_EMAIL_BITMAP,
    readyKey: AUTH_USER_LOOKUP_KEYS.USER_EMAIL_BITMAP_READY
  })
}

run()
  .catch((error) => {
    logger.error('[APP:Scripts] User email bitmap backfill failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    process.exitCode = 1
  })
  .finally(async () => {
    await Promise.all([mongoose.disconnect(), RedisDatabase.disconnect()])
  })

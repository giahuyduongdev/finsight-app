import 'dotenv/config'
import mongoose from 'mongoose'
import { mongoConfig } from '../config/db.config'
import RefreshTokenModel from '../models/refresh-token.model'
import { logger } from '../config/logger.config'

const DIGEST_PATTERN = /^[a-f0-9]{64}$/

export const revokePlaintextRefreshTokens = async (): Promise<number> => {
  const result = await RefreshTokenModel.deleteMany({
    token: { $not: DIGEST_PATTERN }
  })

  return result.deletedCount || 0
}

const run = async (): Promise<void> => {
  await mongoose.connect(mongoConfig.uri, mongoConfig.options)

  const deletedCount = await revokePlaintextRefreshTokens()
  logger.info('[APP:Scripts] Plaintext refresh tokens revoked', {
    deletedCount
  })
}

if (require.main === module) {
  run()
    .catch((error) => {
      logger.error('[APP:Scripts] Plaintext refresh token cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      process.exitCode = 1
    })
    .finally(async () => {
      await mongoose.disconnect()
    })
}

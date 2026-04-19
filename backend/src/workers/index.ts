import { logger } from '../config/logger.config'

import { transactionWorker } from './transaction.worker'

const workers = [transactionWorker]

export const initializeWorkers = () => {
  logger.info(
    `⚙️  [BullMQ] The workers have started up: ${workers.length} successfully. Waiting for work...`
  )
  return workers
}

export const stopWorkers = async () => {
  logger.info('🛑 [BullMQ] We are asking workers to stop accepting new jobs...')
  await Promise.all(workers.map((w) => w.close()))
  logger.info('✅ [BullMQ] All workers stopped safely.')
}

import { logger } from '../config/logger.config'

import { transactionWorker } from './transaction.worker'
import { receiptWorker } from './receipt.worker'
import { reportWorker } from './report.worker'
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

const workers = [transactionWorker, receiptWorker, reportWorker]

export const initializeWorkers = () => {
  logger.info(
    logIcon(
      LOG_ICONS.WORKER,
      ` [BullMQ] The workers have started up: ${workers.length} successfully. Waiting for work...`
    )
  )
  return workers
}

export const stopWorkers = async () => {
  logger.info(
    logIcon(
      LOG_ICONS.STOP,
      '[BullMQ] We are asking workers to stop accepting new jobs...'
    )
  )
  await Promise.all(workers.map((w) => w.close()))
  logger.info(
    logIcon(LOG_ICONS.SUCCESS, '[BullMQ] All workers stopped safely.')
  )
}

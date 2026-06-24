import { logger } from '../config/logger.config'
import { metricsConfig } from './metrics.config'
import { collectBullMQQueueDepth } from './bullmq.metrics'

type QueueRegistration = {
  name: string
  queue: Parameters<typeof collectBullMQQueueDepth>[1]
}

let pollTimer: NodeJS.Timeout | null = null

export const startQueueMetricsPolling = (
  registrations: QueueRegistration[]
) => {
  if (!metricsConfig.enabled || pollTimer) return

  const collect = async () => {
    await Promise.all(
      registrations.map(async ({ name, queue }) => {
        try {
          await collectBullMQQueueDepth(name, queue)
        } catch (error) {
          logger.warn('[SYS:Metrics] Failed to collect queue depth', {
            queueName: name,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })
    )
  }

  void collect()
  pollTimer = setInterval(collect, metricsConfig.queuePollIntervalMs)
  pollTimer.unref()
}

export const stopQueueMetricsPolling = () => {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

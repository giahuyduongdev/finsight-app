import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { transactionQueue, receiptQueue } from '../../queues'

export const setupBullBoard = () => {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath('/admin/queues')

  createBullBoard({
    queues: [new BullMQAdapter(transactionQueue), new BullMQAdapter(receiptQueue)],
    serverAdapter
  })

  return serverAdapter.getRouter()
}

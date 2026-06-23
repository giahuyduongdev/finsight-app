import {
  buildReportDeliveryKey,
  buildReportJobId
} from '../../utils/report-delivery.util'

describe('report delivery identity', () => {
  const dueDate = new Date('2026-06-01T00:00:00.000Z')

  it('builds one stable business identity for a scheduled delivery', () => {
    expect(buildReportDeliveryKey('setting-123', dueDate)).toBe(
      'report/setting-123/2026-06-01T00:00:00.000Z'
    )
  })

  it('builds a BullMQ-safe job id without colon separators', () => {
    expect(buildReportJobId('setting-123', dueDate)).toBe(
      'process-report-setting-123-1780272000000'
    )
  })
})

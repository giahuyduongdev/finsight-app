const mockSendEmail = jest.fn()

jest.mock('../../../mailers/mailer', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args)
}))

import { sendReportEmail } from '../../../mailers/report.mailer'

describe('report mailer', () => {
  it('forwards the stable provider idempotency key', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email-123' }, error: null })

    await sendReportEmail({
      email: 'user@example.com',
      username: 'User',
      frequency: 'MONTHLY',
      idempotencyKey: 'report/setting-123/2026-06-01T00:00:00.000Z',
      report: {
        period: 'May 2026',
        totalIncome: 100,
        totalExpenses: 50,
        availableBalance: 50,
        savingsRate: 50,
        topSpendingCategories: [],
        insights: [],
        currency: 'USD'
      }
    })

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'report/setting-123/2026-06-01T00:00:00.000Z'
      })
    )
  })
})

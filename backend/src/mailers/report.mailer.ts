import { formatCurrency } from '../utils/format-currency.util'
import { getReportEmailTemplate } from './templates/report.template'
import { sendEmail } from './mailer'
import { ReportType } from '../@types/report.type'

type ReportEmailParams = {
  email: string
  username: string
  report: ReportType
  frequency: string
}

export const sendReportEmail = async (params: ReportEmailParams) => {
  const { email, username, report, frequency } = params
  const currency = report.currency || 'USD'

  const html = getReportEmailTemplate(
    {
      username,
      ...report
    },
    frequency
  )

  const text = `Your ${frequency} Financial Report (${report.period})
    Income: ${formatCurrency(report.totalIncome, currency)}
    Expenses: ${formatCurrency(report.totalExpenses, currency)}
    Balance: ${formatCurrency(report.availableBalance, currency)}
    Savings Rate: ${report.savingsRate.toFixed(2)}%

    ${report.insights.join('\n')}
`

  return sendEmail({
    to: email,
    subject: `${frequency} Financial Report - ${report.period}`,
    text,
    html
  })
}

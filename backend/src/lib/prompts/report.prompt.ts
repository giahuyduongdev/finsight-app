import { formatCurrency } from '../../utils/format-currency.util'

export const reportInsightPrompt = ({
  totalIncome,
  totalExpenses,
  availableBalance,
  savingsRate,
  categories,
  periodLabel,
  currency = 'USD'
}: {
  totalIncome: number
  totalExpenses: number
  availableBalance: number
  savingsRate: number
  categories: Record<string, { amount: number; percentage: number }>
  periodLabel: string
  currency?: string
}) => {
  const categoryList = Object.entries(categories)
    .map(
      ([name, { amount, percentage }]) =>
        `- ${name}: ${formatCurrency(amount, currency)} (${percentage}%)`
    )
    .join('\n')

  return `
  You are a friendly and smart financial coach, not a robot.

Your job is to give **exactly 3 good short insights** to the user based on their data that feel like you're talking to them directly.

Each insight should reflect the actual data and sound like something a smart money coach would say based on the data — short, clear, and practical.

🧾 Report for: ${periodLabel}
- Total Income: ${formatCurrency(totalIncome, currency)}
- Total Expenses: ${formatCurrency(totalExpenses, currency)}
- Available Balance: ${formatCurrency(availableBalance, currency)}
- Savings Rate: ${savingsRate}%

Top Expense Categories:
${categoryList}

📌 Guidelines:
- Keep each insight to one short, realistic, personalized, natural sentence
- Use conversational language, correct wordings & Avoid sounding robotic, or generic
- Include specific data when helpful and comma to amount
- Be encouraging if user spent less than they earned
- Format your response **exactly** like this:

["Insight 1", "Insight 2", "Insight 3"]

✅ Example:
[
   "Nice! You kept ${formatCurrency(7458, currency)} after expenses — that's solid breathing room.",
   "You spent the most on 'Meals' this period — 32%. Maybe worth keeping an eye on.",
   "You stayed under budget this time. That's a win — keep the momentum"
]

⚠️ Output only a **JSON array of 3 strings**. Do not include any explanation, markdown, or notes.
  
  `.trim()
}

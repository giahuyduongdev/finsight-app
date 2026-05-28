export const formatCurrency = (
  amount: number,
  currency: string = 'USD'
): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount)

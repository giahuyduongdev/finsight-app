import { Card, CardContent } from '@/components/ui/card'
import PageLayout from '@/components/page-layout'
import AddTransactionDrawer from '@/features/transaction/components/add-transaction-drawer'
import TransactionTable from '@/features/transaction/components/transaction-table'
import ImportTransactionModal from '@/features/transaction/components/import-transaction-modal'

export default function Transactions() {
  return (
    <PageLayout
      title="All Transactions"
      subtitle="Showing all transactions"
      addMarginTop
      isFullWidth={true}
      rightAction={
        <div className="flex items-center gap-2">
          <ImportTransactionModal />
          <AddTransactionDrawer />
        </div>
      }
    >
      <Card className="border-0 shadow-none">
        <CardContent className="pt-2">
          <TransactionTable pageSize={20} />
        </CardContent>
      </Card>
    </PageLayout>
  )
}

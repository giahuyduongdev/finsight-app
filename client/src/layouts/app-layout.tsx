import Navbar from '@/components/navbar'
import { Outlet } from 'react-router-dom'
import EditTransactionDrawer from '@/components/transaction/edit-transaction-drawer'
import { useBulkImportSocket } from '@/hooks/use-bulk-import-socket'

const AppLayout = () => {
  useBulkImportSocket()
  return (
    <>
      <div className="min-h-screen pb-10">
        <Navbar />
        <main className="w-full max-w-full">
          <Outlet />
        </main>
      </div>
      <EditTransactionDrawer />
    </>
  )
}

export default AppLayout

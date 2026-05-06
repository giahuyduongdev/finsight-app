import Navbar from '@/components/navbar'
import { Outlet } from 'react-router-dom'
import EditTransactionDrawer from '@/features/transaction/components/edit-transaction-drawer'
import { useAppSockets } from '@/hooks/use-app-sockets'

const AppLayout = () => {
  useAppSockets()
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

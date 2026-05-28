import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket' // Assuming a centralized socket getter exists

export interface ExchangeRates {
  base: string
  rates: Record<string, number>
  updatedAt: string
}

export const useExchangeRates = () => {
  const [rates, setRates] = useState<ExchangeRates | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    setIsConnected(socket.connected)

    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)
    const handleRatesUpdate = (data: ExchangeRates) => {
      setRates(data)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('currency:rates_updated', handleRatesUpdate)

    // Lần đầu vào trang có thể trigger một event để lấy ngay rates hiện tại nếu cần
    // socket.emit('currency:get_latest_rates')

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('currency:rates_updated', handleRatesUpdate)
    }
  }, [])

  return { rates, isConnected }
}

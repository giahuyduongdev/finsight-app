import axios from 'axios'
import { redis } from '../config/redis.config'

export const getExchangeRate = async (
  from: string,
  to: string
): Promise<number> => {
  // Nếu cùng currency → tỉ giá = 1
  if (from === to) return 1

  // Check Redis cache trước
  const cached = await redis.get(`rate:${from}:${to}`)
  if (cached) return parseFloat(cached)

  // Gọi API lấy tỉ giá mới
  const res = await axios.get(
    `https://api.exchangerate-api.com/v4/latest/${from}`
  )
  const rate = res.data.rates[to]

  if (!rate) throw new Error(`Exchange rate not found for ${from} to ${to}`)

  // Cache 1 giờ
  await redis.set(`rate:${from}:${to}`, rate.toString(), 'EX', 3600)

  return rate
}

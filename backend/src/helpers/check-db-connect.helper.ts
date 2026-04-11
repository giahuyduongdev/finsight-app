import mongoose from 'mongoose'
import os from 'os'
import { Env } from '../config/env.config'
import { logger } from '../config/logger.config'

// Chuẩn hóa tên hằng số (viết hoa toàn bộ cho hằng số global)
const MONITOR_INTERVAL_MS = 5000
let monitorInterval: NodeJS.Timeout | null = null

/**
 * Đếm số lượng kết nối hiện tại tới MongoDB
 */
export const countConnect = (): number => {
  const numConnection = mongoose.connections.length

  // Chỉ in log thông tin khi đang ở môi trường code (development)
  if (Env.NODE_ENV === 'development') {
    logger.info(`[DB Monitor] Number of connections: ${numConnection}`)
  }

  return numConnection
}

/**
 * Theo dõi quá tải kết nối và RAM định kỳ
 */
export const checkOverload = () => {
  // Trả về đối tượng Timeout để sau này nếu cần có thể gọi clearInterval() để dừng
  monitorInterval = setInterval(() => {
    const numConnection = mongoose.connections.length
    const numCores = os.cpus().length

    // Tính toán RAM (chỉ lấy phần RSS - Resident Set Size)
    const memoryUsage = process.memoryUsage().rss
    const memoryUsageMB = memoryUsage / 1024 / 1024

    // Đặt biến rõ ràng để dễ bảo trì
    const maxPoolSize = Number(Env.MONGO_MAX_POOL_SIZE_PER_CORE) || 5
    const maxConnections = numCores * maxPoolSize
    const memoryThresholdMB = Number(Env.MEMORY_THRESHOLD_MB) || 500

    // THÔNG TIN ĐỊNH KỲ: Chỉ in ra khi đang code (dev) để tránh rác log trên Server thật
    if (Env.NODE_ENV === 'development') {
      logger.info(
        `⚙️  [DB Monitor] Connections: ${numConnection}/${maxConnections} | RAM: ${memoryUsageMB.toFixed(2)}/${memoryThresholdMB} MB`
      )
    }

    // CẢNH BÁO QUAN TRỌNG: Luôn in ra ở mọi môi trường nếu hệ thống chạm ngưỡng
    if (numConnection > maxConnections) {
      logger.warn(
        `🚨  [WARNING] Connection overload detected! Active: ${numConnection}, Max: ${maxConnections}`
      )
      // Ở hệ thống lớn, người ta thường gọi thêm 1 API bắn tin nhắn về Telegram/Slack cho team Dev ở dòng này
    }

    if (memoryUsageMB > memoryThresholdMB) {
      logger.warn(
        `🚨  [WARNING] Memory overload detected! Usage: ${memoryUsageMB.toFixed(2)} MB, Limit: ${memoryThresholdMB} MB`
      )
    }
  }, MONITOR_INTERVAL_MS)
}

export const stopOverload = () => {
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
    logger.info('✅ DB Monitor stopped')
  }
}

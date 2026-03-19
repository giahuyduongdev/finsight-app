import mongoose from 'mongoose'
import os from 'os'
import { Env } from '../config/env.config'

const _SECONDS = 5000

export const countConnect = (): number => {
  const numConnection = mongoose.connections.length
  console.log(`Number of connections:: ${numConnection}`)
  return numConnection
}

export const checkOverload = (): void => {
  setInterval(() => {
    const numConnection = mongoose.connections.length
    const numCores = os.cpus().length
    const memoryUsage = process.memoryUsage().rss
    const memoryUsageMB = memoryUsage / 1024 / 1024

    const maxConnections =
      numCores * Number(Env.MONGO_MAX_POOL_SIZE_PER_CORE || 5)

    console.log(`Active connections:: ${numConnection}`)
    console.log(`Memory usage:: ${memoryUsageMB.toFixed(2)} MB`)

    if (numConnection > maxConnections) {
      console.log(`Connection overload detected!`)
    }

    if (memoryUsageMB > Number(Env.MEMORY_THRESHOLD_MB || 500)) {
      console.log(`Memory overload detected: ${memoryUsageMB.toFixed(2)} MB`)
    }
  }, _SECONDS)
}

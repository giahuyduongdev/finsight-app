import app from './src/app'
import { Env } from './src/config/env.config'
import connectDB from './src/config/database.config'
import { initializeCrons } from './src/cron'
import { checkOverload } from './src/utils/check-db-connect'

const startServer = async () => {
  try {
    await connectDB()
    // checkOverload()

    if (Env.NODE_ENV === 'development') {
      await initializeCrons()
    }

    const server = app.listen(Env.PORT, () => {
      console.log(
        `Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`
      )
    })

    const shutdown = (signal: string) => {
      console.log(`${signal} received, shutting down...`)
      server.close(() => {
        console.log('Server closed')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

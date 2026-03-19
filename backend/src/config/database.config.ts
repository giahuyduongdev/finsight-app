import mongoose from 'mongoose'
import { Env } from '../config/env.config'

class Database {
  private static instance: Database

  private constructor() {}

  private async connect(): Promise<void> {
    try {
      if (Env.NODE_ENV === 'development') {
        mongoose.set('debug', true)
        mongoose.set('debug', { color: true })
      }

      await mongoose.connect(Env.MONGO_URI, {
        maxPoolSize: Number(Env.MONGO_MAX_POOL_SIZE),
        serverSelectionTimeoutMS: Number(Env.MONGO_SERVER_SELECTION_TIMEOUT),
        socketTimeoutMS: Number(Env.MONGO_SOCKET_TIMEOUT),
        connectTimeoutMS: Number(Env.MONGO_CONNECT_TIMEOUT)
      })

      console.log(
        `Connected to MongoDB — Active connections: ${mongoose.connections.length}`
      )
    } catch (error) {
      console.error('Error connecting to MongoDB: ', error)
      process.exit(1)
    }
  }

  static async getInstance(): Promise<void> {
    if (!Database.instance) {
      Database.instance = new Database()
      await Database.instance.connect()
    }
  }
}

const connectDatabase = async (): Promise<void> => {
  await Database.getInstance()
}

export default connectDatabase

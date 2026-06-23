import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuredPort = Number(env.VITE_DEV_PORT)
  const port =
    Number.isInteger(configuredPort) &&
    configuredPort > 0 &&
    configuredPort <= 65_535
      ? configuredPort
      : undefined

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port,
      strictPort: port !== undefined
    }
  }
})

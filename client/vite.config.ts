import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const getVendorChunkName = (id: string) => {
  if (!id.includes('node_modules')) {
    return undefined
  }

  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('react-redux') ||
    id.includes('@reduxjs') ||
    id.includes('/redux/') ||
    id.includes('redux-persist') ||
    id.includes('/scheduler/')
  ) {
    return 'vendor-react-core'
  }

  if (id.includes('react-router')) {
    return 'vendor-react-router'
  }

  if (id.includes('recharts')) {
    return 'vendor-recharts'
  }

  if (
    id.includes('/d3-') ||
    id.includes('victory-vendor') ||
    id.includes('/clsx/') ||
    id.includes('/tiny-invariant/')
  ) {
    return 'vendor-chart-utils'
  }

  if (id.includes('@radix-ui')) {
    return 'vendor-radix'
  }

  if (
    id.includes('react-hook-form') ||
    id.includes('@hookform') ||
    id.includes('/zod/')
  ) {
    return 'vendor-forms'
  }

  if (id.includes('@tanstack')) {
    return 'vendor-table'
  }

  return undefined
}

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
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: getVendorChunkName
        }
      }
    }
  }
})

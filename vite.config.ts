import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development'

// Only read SSL files if they exist (development only)
const httpsConfig =
  isDev && fs.existsSync('./localhost-key.pem') && fs.existsSync('./localhost.pem')
    ? {
        key: fs.readFileSync('./localhost-key.pem'),
        cert: fs.readFileSync('./localhost.pem'),
      }
    : undefined

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    ...(httpsConfig && { https: httpsConfig }),
    proxy: {
      '/api': {
        target: httpsConfig ? 'https://localhost:3001' : 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})

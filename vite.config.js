import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { investmentsApi } from './vite-plugins/investments-api.js'

// Served from https://meichihch.github.io/finance-dashboard/ once built; the dev
// server (and the Mac background service) keeps serving from the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/finance-dashboard/' : '/',
  plugins: [react(), investmentsApi()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
}))

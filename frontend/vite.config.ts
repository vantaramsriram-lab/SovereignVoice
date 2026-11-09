import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The browser never talks to Gnani or Groq directly: every request
// goes to our own FastAPI backend. In development Vite proxies those paths so
// the frontend and backend can run side by side on different ports.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow the sandboxed preview host to reach the dev server.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})

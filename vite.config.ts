import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The single bundle is dominated by the exercise database itself — 131
  // exercises with muscles, steps, progressions and animation poses. It is
  // shipped as data, not lazy-loaded, because the Library is the first screen
  // most people open and the app is offline-first with no server to fetch from.
  build: {
    chunkSizeWarningLimit: 700,
  },
  server: {
    host: true,
    port: 5173,
  },
})

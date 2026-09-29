import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// dev: เรียก /api/... แล้ว proxy ไป FastAPI (uvicorn port 8000) ไม่ต้องตั้ง CORS ที่ backend
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
})

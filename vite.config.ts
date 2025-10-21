import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  base: '/family-splitter/', // ✅ si es Project Page; usa '/' si es user.github.io
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
})

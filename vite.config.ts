import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the production build also runs from a plain static folder.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { sourcemap: false, outDir: 'dist' },
})

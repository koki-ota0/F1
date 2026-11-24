import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Absolute base by default so built assets resolve from the site root even on
  // deep routes (/drivers/max-verstappen). A relative './' base makes the
  // browser look for /drivers/assets/index-*.js and blanks the whole app.
  // GitHub Pages project site: set VITE_BASE=/F1/ at build time (see workflow).
  base: process.env.VITE_BASE || '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Single bundle (no code-splitting): the jsdom QA harness executes the
    // built asset as one classic script, so dynamic imports would fail there
    // even though they work in a browser.
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})

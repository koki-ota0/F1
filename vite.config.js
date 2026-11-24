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
    // Fold the dynamically-imported three.js module into the app bundle.
    // A separate chunk would be fetched with an import at runtime, which the
    // jsdom smoke harness (classic script, no modules) cannot execute — the
    // build then fails QA even though the browser works. One bundle keeps both
    // consumers happy; the lazy load is not worth the tooling breakage.
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})

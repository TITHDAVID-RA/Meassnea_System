import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { nodePolyfills } from 'vite-plugin-node-polyfills' // <-- 1. Import this

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    nodePolyfills({
      // Enable specific polyfills required by xlsx / xlsx-js-style
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }), // <-- 2. Add this to the list
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
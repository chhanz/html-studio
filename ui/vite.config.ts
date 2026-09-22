import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Build stamp shown in the status bar so a stale cached bundle is visible at a glance.
  define: { __HS_BUILD__: JSON.stringify(new Date().toISOString().slice(11, 16).replace(':', '')) },
  build: {
    lib: {
      entry: 'src/App.tsx',
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    outDir: 'dist',
    rollupOptions: {
      external: [
        'react', 'react-dom', 'react/jsx-runtime',
        '@kirocrew/app-sdk', '@kirocrew/app-sdk/ui', 'lucide-react',
      ],
    },
  },
})

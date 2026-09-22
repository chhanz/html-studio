// Builds standalone ES modules for every bare specifier the UI bundle imports
// (react, react-dom, react/jsx-runtime, @kirocrew/app-sdk, @kirocrew/app-sdk/ui,
// lucide-react). The harness maps those specifiers to these files via an
// import map, so the production bundle runs unmodified.
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const here = resolve(new URL('.', import.meta.url).pathname)

export default defineConfig({
  root: here,
  logLevel: 'warn',
  // React's CJS entry switches on process.env.NODE_ENV; there is no `process` in the browser.
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    minify: false,
    lib: {
      formats: ['es'],
      entry: {
        react: resolve(here, 'entries/react.js'),
        'react-dom': resolve(here, 'entries/react-dom.js'),
        'react-dom-client': resolve(here, 'entries/react-dom-client.js'),
        'jsx-runtime': resolve(here, 'entries/jsx-runtime.js'),
        'app-sdk': resolve(here, 'app-sdk.js'),
        'app-sdk-ui': resolve(here, 'app-sdk-ui.js'),
        'lucide-react': resolve(here, 'entries/lucide-react.js'),
      },
      fileName: (_fmt, name) => `${name}.mjs`,
    },
    // No externals on purpose: rollup hoists react into ONE shared chunk that
    // every entry imports, so the harness has a single React instance.
    rollupOptions: { output: { preserveModules: false } },
  },
})

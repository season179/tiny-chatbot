import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'TinyChatbotWidget',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'widget.es.js' : 'widget.umd.js')
    },
    rollupOptions: {
      external: ['preact'],
      output: {
        globals: {
          preact: 'Preact'
        }
      }
    }
  }
});

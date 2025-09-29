import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config';

export default mergeConfig(baseConfig, defineConfig({
  server: {
    host: '127.0.0.1',
    port: 0,
    strictPort: false
  },
  preview: {
    host: '127.0.0.1',
    port: 0,
    strictPort: false
  }
}));

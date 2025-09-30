import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  sourcemap: true,
  clean: true,
  target: 'node18',
  format: ['esm'],
  dts: true,
  splitting: false,
  minify: false
});

import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/plugin.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  shims: true,
  dts: true,
  exports: true,
});

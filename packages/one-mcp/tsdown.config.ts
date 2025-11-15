import { defineConfig } from 'tsdown';
import Raw from 'unplugin-raw/rolldown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  shims: true,
  dts: true,
  exports: true,
  plugins: [Raw()],
});

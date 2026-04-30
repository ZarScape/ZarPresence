import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/extension/background.ts'),
        youtube: resolve(__dirname, 'src/extension/youtube.ts'),
        crunchyroll: resolve(__dirname, 'src/extension/crunchyroll.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    outDir: 'dist-extension',
    emptyOutDir: true,
  }
});
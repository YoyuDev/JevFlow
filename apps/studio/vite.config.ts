import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Bind IPv4 explicitly: Node resolves `localhost` to `::1` first, so a
    // Vite default would leave http://127.0.0.1:5173 unreachable even though the
    // API server next door listens on 127.0.0.1.
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    proxy: {
      // The Studio talks to the Fastify server only through /api.
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
});

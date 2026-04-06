import { defineConfig, loadEnv } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiOrigin = env.VITE_API_ORIGIN || 'http://127.0.0.1:3333';
  const repoRoot = join(__dirname, '../../..');
  const appEntry = join(__dirname, 'index.html');
  const landingEntry = join(__dirname, 'landing.html');

  return {
    root: __dirname,
    base: mode === 'production' ? '/static/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      fs: {
        allow: [repoRoot],
      },
      proxy: {
        '/api': { target: apiOrigin, changeOrigin: true },
        '/auth': { target: apiOrigin, changeOrigin: true },
        '/logout': { target: apiOrigin, changeOrigin: true },
      },
    },
    build: {
      outDir: join(__dirname, '../static'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          app: appEntry,
          landing: landingEntry,
        },
      },
    },
  };
});

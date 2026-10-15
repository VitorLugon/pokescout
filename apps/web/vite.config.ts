import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:3001';
  // Both dev and preview use the same restricted local API proxy.
  const proxy = { '^/api(?:/|$)': { target, rewrite: (path: string) => path.replace(/^\/api/, '') } };
  return {
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
  };
});

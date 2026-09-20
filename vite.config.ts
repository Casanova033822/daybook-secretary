import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react(), { name: 'development-csp', apply: 'serve', transformIndexHtml: html => html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace("connect-src 'none'", "connect-src 'self' ws://127.0.0.1:5173") }], base: './', server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks(id) { if (id.includes('@fullcalendar')) return 'calendar'; if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'; } } } },
});

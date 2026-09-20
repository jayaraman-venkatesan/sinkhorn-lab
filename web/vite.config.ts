import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[/\\]node_modules[/\\](?:react|react-dom|scheduler)[/\\]/.test(id)) {
            return 'react-vendor';
          }
          return 'markdown-vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5080',
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

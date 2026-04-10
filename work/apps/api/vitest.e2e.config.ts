/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['src/__tests__/e2e/**/*.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 60000, // 60 seconds for e2e tests
    hookTimeout: 30000,
    setupFiles: ['./src/__tests__/e2e/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@nexus-os/types': resolve(__dirname, '../../packages/types'),
    },
  },
});
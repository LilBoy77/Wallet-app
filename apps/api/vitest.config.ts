import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    env: {
      ENABLE_TOPUP_SIMULATION: 'true',
      UPLOAD_DIR: 'uploads/test-attachments',
    },
  },
});

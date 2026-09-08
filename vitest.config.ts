import { defineConfig } from 'vitest/config';
import { testConfiguration } from './scripts/test-configuration.ts';

export default defineConfig(
  testConfiguration(process.env.PORCELAIN_TEST_SCOPE),
);

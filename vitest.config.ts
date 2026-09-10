import { defineConfig, mergeConfig } from 'vitest/config';
import { webTestConfiguration } from './apps/web/vitest.config.ts';
import { testConfiguration } from './scripts/test-configuration.ts';

const scope = process.env.PORCELAIN_TEST_SCOPE;
const configuration = testConfiguration(scope);
export default defineConfig(
  scope === 'web' || scope === undefined
    ? mergeConfig(configuration, webTestConfiguration)
    : configuration,
);

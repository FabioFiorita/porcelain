import type { BuildInputs } from '../../verify-core/fingerprint.ts';

export const webInputs: BuildInputs = {
  roots: [
    'apps/web/src',
    'apps/web/public',
    'apps/web/index.html',
    'apps/web/vite.config.ts',
  ],
  apps: ['apps/web'],
};

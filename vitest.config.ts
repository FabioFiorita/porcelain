import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));
const packages = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name !== 'client' &&
      existsSync(join(root, 'packages', entry.name, 'src')),
  )
  .map((entry) => entry.name);

export default defineConfig({
  test: {
    root,
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: '@porcelain/server',
          root,
          include: ['apps/server/src/**/*.spec.ts'],
        },
      },
      ...packages.map((name) => ({
        test: {
          name: `@porcelain/${name}`,
          root,
          include: [`packages/${name}/src/**/*.spec.ts`],
        },
      })),
    ],
  },
});

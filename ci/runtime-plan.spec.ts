import { expect, it } from 'vite-plus/test';
import { runtimePlan } from './runtime-plan.ts';

it('runs touched browser specs, a separate smoke and storage checks on main', () => {
  const live = [
    'apps/web/spec/integration/walkthroughs-page.test.tsx',
    'apps/web/spec/e2e/access-pairing.e2e.ts',
  ];
  const plan = runtimePlan(
    false,
    [...live, 'apps/web/spec/e2e/removed.e2e.ts', 'packages/storage/db.ts'],
    live,
  );
  expect(plan).toMatchObject({
    integration: ['spec/integration/walkthroughs-page.test.tsx'],
    e2e: ['spec/e2e/access-pairing.e2e.ts', 'spec/e2e/app-routing.e2e.ts'],
    shards: [1],
    storage: true,
    server: false,
    desktop: false,
    package: false,
  });
});

it('runs every runtime job with a browser integration smoke for root Vite configuration changes', () => {
  expect(
    runtimePlan(
      false,
      ['vite.config.ts'],
      ['apps/web/spec/integration/changes-branch-base.test.tsx'],
    ),
  ).toEqual({
    server: true,
    'web-integration': true,
    'web-e2e': true,
    desktop: true,
    storage: true,
    package: true,
    shards: [1],
    integration: ['spec/integration/changes-branch-base.test.tsx'],
    e2e: ['spec/e2e/access-pairing.e2e.ts'],
  });
});

it('uses an unchanged browser integration spec when the preferred smoke was deleted', () => {
  expect(
    runtimePlan(
      false,
      [
        'vite.config.ts',
        'apps/web/spec/integration/changes-branch-base.test.tsx',
      ],
      [
        'apps/web/spec/integration/helper.test.ts',
        'apps/web/spec/integration/walkthroughs-page.test.tsx',
      ],
    ),
  ).toMatchObject({
    'web-integration': true,
    integration: ['spec/integration/walkthroughs-page.test.tsx'],
  });
});

it('requires every runtime suite on promotion even when only documentation changed', () => {
  expect(runtimePlan(true, ['README.md'], ['README.md'])).toMatchObject({
    server: true,
    'web-integration': true,
    'web-e2e': true,
    desktop: true,
    storage: true,
    package: true,
    shards: [1, 2, 3, 4],
  });
  expect(runtimePlan(false, ['README.md'], ['README.md'])).toMatchObject({
    'web-integration': false,
    'web-e2e': false,
    storage: false,
  });
});

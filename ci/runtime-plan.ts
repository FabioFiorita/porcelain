import { execFileSync } from 'node:child_process';

export function runtimePlan(
  release: boolean,
  changed: readonly string[],
  present: readonly string[],
) {
  const specs = (pattern: RegExp) =>
    present
      .filter((path) => pattern.test(path))
      .map((path) => path.slice('apps/web/'.length));
  const integration = specs(/^apps\/web\/spec\/integration\/.+\.test\.tsx?$/);
  const e2e = specs(/^apps\/web\/spec\/e2e\/.+\.e2e\.ts$/);
  const web = changed.some((path) =>
    /^(?:apps\/(?:web|server)\/|packages\/|pnpm-lock\.yaml$)/.test(path),
  );
  const smoke = 'spec/e2e/access-pairing.e2e.ts';
  return {
    server: release,
    'web-integration': release || integration.length > 0,
    'web-e2e': release || web,
    desktop: release,
    storage:
      release || changed.some((path) => path.startsWith('packages/storage/')),
    package: release,
    shards: release ? [1, 2, 3, 4] : [1],
    integration,
    e2e: [
      ...new Set([
        ...e2e,
        smoke,
        ...(e2e.includes(smoke) ? ['spec/e2e/app-routing.e2e.ts'] : []),
      ]),
    ],
  };
}

if (import.meta.main) {
  const base = process.env.DIFF_BASE;
  if (!base || !/^[0-9a-f]{40}$/.test(base))
    throw new Error('Missing CI base commit');
  const files = (filter: string) =>
    execFileSync(
      'git',
      ['diff', '--no-renames', '--name-only', '-z', filter, base, 'HEAD', '--'],
      { encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean);
  const plan = runtimePlan(
    process.env.RELEASE_LANE === 'true',
    files('--diff-filter=ADMT'),
    files('--diff-filter=AMT'),
  );
  for (const [name, value] of Object.entries(plan))
    console.log(`${name}=${JSON.stringify(value)}`);
}

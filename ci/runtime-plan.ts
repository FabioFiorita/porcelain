import { execFileSync } from 'node:child_process';

export function runtimePlan(
  release: boolean,
  changed: readonly string[],
  browserSpecsAtHead: readonly string[],
) {
  const changedPaths = new Set(changed);
  const specs = (pattern: RegExp) =>
    browserSpecsAtHead.filter((path) => pattern.test(path));
  const relativeToWeb = (path: string) => path.slice('apps/web/'.length);
  const integrationSpecs = specs(
    /^apps\/web\/spec\/integration\/[^/]+\.test\.tsx$/,
  );
  const integration = new Set(
    integrationSpecs.filter((path) => changedPaths.has(path)),
  );
  const e2e = specs(/^apps\/web\/spec\/e2e\/.+\.e2e\.ts$/)
    .filter((path) => changedPaths.has(path))
    .map(relativeToWeb);
  const toolchain = changedPaths.has('vite.config.ts');
  if (toolchain && !release) {
    const preferred = 'apps/web/spec/integration/changes-branch-base.test.tsx';
    const smoke = integrationSpecs.includes(preferred)
      ? preferred
      : integrationSpecs[0];
    if (smoke) integration.add(smoke);
  }
  const allRuntime = release || toolchain;
  const web = changed.some((path) =>
    /^(?:apps\/(?:web|server)\/|packages\/|pnpm-lock\.yaml$)/.test(path),
  );
  const smoke = 'spec/e2e/access-pairing.e2e.ts';
  return {
    server: allRuntime,
    'web-integration': release || integration.size > 0,
    'web-e2e': allRuntime || web,
    desktop: allRuntime,
    storage:
      allRuntime ||
      changed.some((path) => path.startsWith('packages/storage/')),
    package: allRuntime,
    shards: release ? [1, 2, 3, 4] : [1],
    integration: [...integration].map(relativeToWeb),
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
  const files = (args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
  const plan = runtimePlan(
    process.env.RELEASE_LANE === 'true',
    files([
      'diff',
      '--no-renames',
      '--name-only',
      '-z',
      '--diff-filter=ADMT',
      base,
      'HEAD',
      '--',
    ]),
    files([
      'ls-tree',
      '-r',
      '-z',
      '--name-only',
      'HEAD',
      '--',
      'apps/web/spec',
    ]),
  );
  for (const [name, value] of Object.entries(plan))
    console.log(`${name}=${JSON.stringify(value)}`);
}

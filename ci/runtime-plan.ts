import { execFileSync } from 'node:child_process';

const packageInputs = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts/build-package.ts',
  'scripts/check-package.sh',
];

const browserIntegrationSpec =
  /^apps\/web\/spec\/integration\/[^/]+\.test\.tsx$/;
const kernelTestKit = 'packages/kernel/spec/kit/';
const migrations = 'packages/storage/drizzle/';
const webBuild = /^apps\/web\/(?:vite\.config\.ts|dev-pair\.ts)$/;
const sandboxHarness = (path: string) =>
  path.startsWith(kernelTestKit) ||
  path.startsWith(migrations) ||
  /^apps\/server\/spec\/(?:kit|fakes|fixtures)\//.test(path);
const browserIntegrationHarness = (path: string) =>
  sandboxHarness(path) ||
  webBuild.test(path) ||
  /^apps\/web\/(?:vitest\.config\.ts$|spec\/(?:kit\/|integration\/))/.test(
    path,
  );
const serverIntegrationHarness = (path: string) =>
  sandboxHarness(path) ||
  path === 'vitest.integration.config.ts' ||
  path.startsWith('apps/server/spec/integration/') ||
  path.startsWith('packages/client/spec/') ||
  /^apps\/(?:desktop|mobile)\/spec\/kit\//.test(path) ||
  /^apps\/web\/spec\/kit\/(?:protocol|world)\.ts$/.test(path) ||
  /^\.agents\/skills\/(?:spec\/|verify-core\/|[^/]+\/scripts\/)/.test(path);
const browserE2eHarness = (path: string) =>
  sandboxHarness(path) ||
  webBuild.test(path) ||
  /^apps\/web\/(?:playwright\.config\.ts$|spec\/(?:e2e|kit)\/)/.test(path);
const desktopHarness = (path: string) =>
  path.startsWith(kernelTestKit) ||
  path.startsWith(migrations) ||
  webBuild.test(path) ||
  /^apps\/server\/spec\/kit\/(?:owner|development-pairing)\.ts$/.test(path) ||
  /^apps\/desktop\/(?:playwright\.config\.ts$|spec\/)/.test(path);

export const runtimeHarnessInput = (path: string) =>
  browserIntegrationHarness(path) ||
  serverIntegrationHarness(path) ||
  browserE2eHarness(path) ||
  desktopHarness(path);

export function runtimePlan(
  release: boolean,
  changed: readonly string[],
  browserSpecsAtHead: readonly string[],
) {
  const changedPaths = new Set(changed);
  const specs = (pattern: RegExp) =>
    browserSpecsAtHead.filter((path) => pattern.test(path));
  const relativeToWeb = (path: string) => path.slice('apps/web/'.length);
  const integrationSpecs = specs(browserIntegrationSpec);
  const fullBrowserIntegration =
    release ||
    changed.some(
      (path) =>
        !browserIntegrationSpec.test(path) && browserIntegrationHarness(path),
    );
  const integration = new Set(
    fullBrowserIntegration
      ? integrationSpecs
      : integrationSpecs.filter((path) => changedPaths.has(path)),
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
    server: allRuntime || changed.some(serverIntegrationHarness),
    'web-integration': release || integration.size > 0,
    'web-e2e': allRuntime || web || changed.some(browserE2eHarness),
    desktop: allRuntime || changed.some(desktopHarness),
    storage:
      allRuntime ||
      changed.some((path) => path.startsWith('packages/storage/')),
    package: allRuntime || packageInputs.some((path) => changedPaths.has(path)),
    shards: release ? [1, 2, 3, 4] : [1],
    'browser-shards': fullBrowserIntegration ? [1, 2, 3, 4, 5, 6] : [1],
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
  const release = process.env.RELEASE_LANE === 'true';
  const files = (args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
  let changed: string[] = [];
  if (!release) {
    const base = process.env.DIFF_BASE;
    if (!base || !/^[0-9a-f]{40}$/.test(base))
      throw new Error('Missing CI base commit');
    changed = files([
      'diff',
      '--no-renames',
      '--name-only',
      '-z',
      '--diff-filter=ADMT',
      base,
      'HEAD',
      '--',
    ]);
  }
  const plan = runtimePlan(
    release,
    changed,
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

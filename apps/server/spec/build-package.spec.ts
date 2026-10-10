import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';

let root: string;
const metadata = {
  type: 'module',
  version: '1.2.3',
  description: 'Porcelain package',
  engines: { node: '>=24.20.0 <25' },
};
const build = (manifest: unknown) => {
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
  return spawnSync(process.execPath, [join(root, 'scripts/build-package.ts')], {
    encoding: 'utf8',
  });
};
const pinEffectRuntimeDependencies = (
  source: string,
  dependencies: Record<string, string>,
): unknown => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { readFileSync } from 'node:fs';
    const target = process.argv[1];
    process.argv[1] = 'package-proof';
    const { pinEffectRuntimeDependencies } = await import(target);
    const input = JSON.parse(readFileSync(0, 'utf8'));
    process.stdout.write(JSON.stringify(pinEffectRuntimeDependencies(input.source, input.dependencies)));
  `,
      join(root, 'scripts/build-package.ts'),
    ],
    { input: JSON.stringify({ source, dependencies }), encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-package-metadata-'));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(
    resolve('scripts/build-package.ts'),
    join(root, 'scripts/build-package.ts'),
  );
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  mkdirSync(join(root, 'apps/server'), { recursive: true });
  writeFileSync(join(root, 'apps/server/package.json'), '{"dependencies":{}}');
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

it('accepts explicit release metadata and then reports missing build inputs before creating output', () => {
  const result = build(metadata);
  expect(result.status).toBe(1);
  expect(result.stderr.trim()).toBe(
    `Required packaging input is missing: ${join(root, 'apps/web/index.html')}`,
  );
  expect(result.stdout).toBe('');
  expect(existsSync(join(root, 'dist-porcelain'))).toBe(false);
});

it.each(['version', 'description', 'engines'] as const)(
  'refuses missing %s before building instead of substituting release metadata',
  (field) => {
    const manifest: Record<string, unknown> = { ...metadata };
    delete manifest[field];
    const result = build(manifest);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(field);
    expect(result.stderr).toContain('Missing key');
    expect(result.stdout).toBe('');
    expect(existsSync(join(root, 'dist-porcelain'))).toBe(false);
  },
);

it('refuses engines without a node requirement', () => {
  const result = build({ ...metadata, engines: {} });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('node');
  expect(result.stderr).toContain('Missing key');
  expect(existsSync(join(root, 'dist-porcelain'))).toBe(false);
});

it.each(['version', 'description'] as const)('refuses an empty %s', (field) => {
  const result = build({ ...metadata, [field]: '' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(field);
  expect(result.stderr).toContain('length of at least 1');
  expect(existsSync(join(root, 'dist-porcelain'))).toBe(false);
});

const runtimeDependencies = {
  '@effect/platform-node': '4.0.1',
  effect: '4.0.1',
  ws: '8.21.3',
};
const runtimeLockfile = () => ({
  importers: {
    'apps/server': {
      dependencies: {
        '@effect/platform-node': { version: '4.0.1(effect@4.0.1)' },
        effect: { version: '4.0.1' },
      },
    },
  },
  snapshots: {
    '@effect/platform-node@4.0.1(effect@4.0.1)': {
      dependencies: {
        '@effect/platform-node-shared': '4.0.1(effect@4.0.1)',
        effect: '4.0.1',
      },
    },
    '@effect/platform-node-shared@4.0.1(effect@4.0.1)': {
      dependencies: { effect: '4.0.1' },
    },
    'effect@4.0.1': {},
    '@effect/vitest@4.0.2': {},
  },
});

it('pins the runtime Effect graph from the project document, preserving other dependencies and excluding development packages', () => {
  const lockfile = runtimeLockfile();
  lockfile.importers['apps/server'].dependencies[
    '@effect/platform-node'
  ].version = '4.0.2(effect@4.0.1)';
  const snapshots: Record<string, unknown> = lockfile.snapshots;
  snapshots['@effect/platform-node@4.0.2(effect@4.0.1)'] =
    snapshots['@effect/platform-node@4.0.1(effect@4.0.1)'];
  expect(
    pinEffectRuntimeDependencies(
      `---\n${JSON.stringify({ importers: {}, snapshots: {} })}\n---\n${JSON.stringify(lockfile)}`,
      runtimeDependencies,
    ),
  ).toEqual({
    '@effect/platform-node': '4.0.2',
    '@effect/platform-node-shared': '4.0.1',
    effect: '4.0.1',
    ws: '8.21.3',
  });
});

it('handles repeated and cyclic runtime references without duplicating dependencies', () => {
  const lockfile = runtimeLockfile();
  const shared: Record<string, string> =
    lockfile.snapshots['@effect/platform-node-shared@4.0.1(effect@4.0.1)']
      .dependencies;
  shared['@effect/platform-node'] = '4.0.1(effect@4.0.1)';
  expect(
    pinEffectRuntimeDependencies(JSON.stringify(lockfile), runtimeDependencies),
  ).toEqual({
    ...runtimeDependencies,
    '@effect/platform-node-shared': '4.0.1',
  });
});

it.each([
  'importer',
  'dependency',
  'exact version',
  'snapshot',
  'conflicting version',
])('refuses a runtime lockfile with a missing or wrong %s', (fault) => {
  const lockfile = runtimeLockfile();
  if (fault === 'importer')
    delete (lockfile.importers as Record<string, unknown>)['apps/server'];
  if (fault === 'dependency')
    delete (
      lockfile.importers['apps/server'].dependencies as Record<string, unknown>
    )['@effect/platform-node'];
  if (fault === 'exact version')
    lockfile.importers['apps/server'].dependencies[
      '@effect/platform-node'
    ].version = '^4.0.1';
  if (fault === 'snapshot')
    delete (lockfile.snapshots as Record<string, unknown>)[
      '@effect/platform-node-shared@4.0.1(effect@4.0.1)'
    ];
  if (fault === 'conflicting version') {
    lockfile.snapshots[
      '@effect/platform-node-shared@4.0.1(effect@4.0.1)'
    ].dependencies.effect = '4.0.2';
    (lockfile.snapshots as Record<string, unknown>)['effect@4.0.2'] = {};
  }
  expect(() =>
    pinEffectRuntimeDependencies(JSON.stringify(lockfile), runtimeDependencies),
  ).toThrow(
    fault === 'snapshot'
      ? 'Missing runtime snapshot @effect/platform-node-shared'
      : fault === 'conflicting version'
        ? 'Conflicting runtime versions for effect'
        : 'Missing exact runtime version for @effect/platform-node',
  );
});

it.each(['', 'snapshots: [', '{"importers":{},"snapshots":null}'])(
  'refuses an absent or malformed project lockfile (%s)',
  (source) => {
    expect(() =>
      pinEffectRuntimeDependencies(source, runtimeDependencies),
    ).toThrow();
  },
);

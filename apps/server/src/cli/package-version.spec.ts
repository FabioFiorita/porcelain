import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readCliVersion } from './package-version.ts';

let root: string;
const read = (packageRoot = root) =>
  Effect.runPromise(
    readCliVersion(packageRoot).pipe(Effect.provide(NodeServices.layer)),
  );

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-version-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

it('reads the packaged CLI version', async () => {
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: '@fabiofiorita/porcelain', version: '1.2.3' }),
  );
  expect(await read()).toBe('1.2.3');
});

it('reads the real repository version for the unversioned development server', async () => {
  const server = join(root, 'apps/server');
  mkdirSync(server, { recursive: true });
  writeFileSync(
    join(server, 'package.json'),
    JSON.stringify({ name: '@porcelain/server' }),
  );
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'porcelain', version: '2.3.4' }),
  );
  expect(await read(server)).toBe('2.3.4');
});

it.each(['missing', '{broken', '{}', '{"version":42}', '{"version":""}'])(
  'fails clearly instead of inventing a version for %s metadata',
  async (metadata) => {
    if (metadata !== 'missing')
      writeFileSync(join(root, 'package.json'), metadata);
    await expect(read()).rejects.toThrow(
      `Porcelain could not read a required package version from ${join(root, 'package.json')}. Check the package build.`,
    );
  },
);

it('fails clearly when the development repository has no version', async () => {
  const server = join(root, 'apps/server');
  mkdirSync(server, { recursive: true });
  writeFileSync(join(server, 'package.json'), '{"name":"@porcelain/server"}');
  writeFileSync(join(root, 'package.json'), '{}');
  await expect(read(server)).rejects.toThrow(
    'could not read a required package version',
  );
});

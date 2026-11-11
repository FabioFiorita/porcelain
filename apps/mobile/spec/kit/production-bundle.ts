import assert from 'node:assert/strict';
import { Schema } from 'effect';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const mobileRoot = fileURLToPath(new URL('../..', import.meta.url));

const directory = await mkdtemp(join(tmpdir(), 'porcelain-release-bundle-'));
try {
  await promisify(execFile)(
    join(mobileRoot, 'node_modules/.bin/expo'),
    [
      'export',
      '--platform',
      'android',
      '--no-bytecode',
      '--source-maps',
      '--max-workers',
      '2',
      '--output-dir',
      directory,
    ],
    {
      cwd: mobileRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CI: '1',
        EXPO_PUBLIC_PORCELAIN_DEV_PAIR_URL: 'http://10.0.2.2:4738',
      },
    },
  );
  const files = await readdir(directory, { recursive: true });
  const maps = files.filter((path) => path.endsWith('.js.map'));
  assert.equal(maps.length, 1);
  const sourceMap = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({
        sections: Schema.Array(
          Schema.Struct({
            map: Schema.Struct({
              sources: Schema.Array(Schema.String),
              mappings: Schema.String,
            }),
          }),
        ),
      }),
    ),
  )(await readFile(join(directory, maps[0]!), 'utf8'));
  const modules = sourceMap.sections
    .filter(({ map }) => /[A-Za-z0-9+/]/.test(map.mappings))
    .flatMap(({ map }) => map.sources);
  assert.ok(
    modules.includes(
      '/apps/mobile/src/features/access/views/settings-screen.tsx',
    ),
  );
  assert.deepEqual(
    modules.filter(
      (path) =>
        /\/(?:apps|packages)\//.test(path) &&
        (/\/development-[^/]+/.test(path) ||
          path.includes('/features/catalog/')),
    ),
    [],
  );
  const bundle = await readFile(join(directory, maps[0]!.slice(0, -4)), 'utf8');
  assert.ok(!bundle.includes('Explore Text'));
  assert.ok(!bundle.includes('Wrapping and selection'));
  assert.ok(!bundle.includes('Use development server'));
  assert.ok(bundle.includes('Pair a computer'));
  assert.ok(bundle.includes('Reviews & Git'));
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('Production Expo router export excludes development modules');

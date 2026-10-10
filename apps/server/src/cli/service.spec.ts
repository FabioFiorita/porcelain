import { NodeServices } from '@effect/platform-node';
import { Clock, Effect } from 'effect';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { LIMITS } from '../config/limits.ts';
import { runServiceCommand } from './service.ts';

let home: string;
let packageRoot: string;
const originalSearchPath = process.env.PATH;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'porcelain-cli-update-'));
  const service = join(home, '.local/share/porcelain/service');
  packageRoot = join(service, 'runtime/node_modules/@fabiofiorita/porcelain');
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    join(packageRoot, 'package.json'),
    JSON.stringify({ name: '@fabiofiorita/porcelain', version: '1.0.0' }),
  );
  writeFileSync(join(service, 'installed.json'), '{"version":"1.0.0"}');
  const bin = join(home, 'commands');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'systemctl'),
    `#!${process.execPath}
    if (process.argv.includes('is-active')) { process.stdout.write('inactive\\n'); process.exit(3); }
    process.exit(99);
  `,
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, 'npm'),
    `#!${process.execPath}
    if (process.argv[2] === 'view') { process.stdout.write('"1.0.0"\\n'); process.exit(0); }
    process.exit(99);
  `,
    { mode: 0o755 },
  );
  process.env.PATH = bin;
});
afterEach(() => {
  process.env.PATH = originalSearchPath;
  rmSync(home, { recursive: true, force: true });
});

const update = (allowDowngrade: boolean, output: string[]) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clock = yield* Clock.Clock;
      yield* runServiceCommand(
        {
          action: 'update',
          allowDowngrade,
          dataDirectory: join(home, 'data'),
          port: 3000,
        },
        {
          homeDirectory: home,
          searchPath: process.env.PATH ?? '',
          clock,
          limits: LIMITS,
          ownerProbe: { probe: () => Effect.succeed({ kind: 'absent' }) },
          stdout: (text) => output.push(text),
        },
        pathToFileURL(join(packageRoot, 'server/src/cli/service.ts')).href,
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );

it('reports an already current installed service through the CLI update operation', async () => {
  const output: string[] = [];
  await update(false, output);
  expect(output).toEqual([
    'The Porcelain service is already 1.0.0, the newest published version.\n',
  ]);
});

it('rejects --allow-downgrade on the installed command with exact-version instructions', async () => {
  const output: string[] = [];
  await expect(update(true, output)).rejects.toThrow(
    '--allow-downgrade requires an exact version: run `npx @fabiofiorita/porcelain@<version> service update --allow-downgrade`.',
  );
  expect(output).toEqual([]);
});

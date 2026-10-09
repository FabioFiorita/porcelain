import { Effect, type FileSystem, type Path } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readServiceConfiguration,
  readInstalledRecord,
  readUpdateJournal,
  readUpdateRecord,
} from './records.ts';

const run = <A, E>(
  effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)));

let folder: string;
let path: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'porcelain-service-configuration-'));
  path = join(folder, 'configuration.json');
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('readServiceConfiguration', () => {
  it('reads the data directory and port the service was installed with', async () => {
    writeFileSync(
      path,
      JSON.stringify({ dataDirectory: '/home/u/.porcelain', port: 4738 }),
    );
    expect(await run(readServiceConfiguration(path))).toEqual({
      dataDirectory: '/home/u/.porcelain',
      port: 4738,
    });
  });

  it('reads a configuration saved when the service listened on a network host without keeping the host, because sharing lives in the database', async () => {
    writeFileSync(
      path,
      JSON.stringify({
        dataDirectory: '/home/u/.porcelain',
        host: '192.0.2.10',
        port: 4738,
        allowedHosts: ['192.0.2.10'],
      }),
    );
    expect(await run(readServiceConfiguration(path))).toEqual({
      dataDirectory: '/home/u/.porcelain',
      port: 4738,
    });
  });

  it('refuses a configuration without a port', async () => {
    writeFileSync(
      path,
      JSON.stringify({ dataDirectory: '/home/u/.porcelain' }),
    );
    await expect(run(readServiceConfiguration(path))).rejects.toThrow(
      'The saved service configuration is invalid.',
    );
  });
});

it('distinguishes a missing install record from malformed saved installation data', async () => {
  expect(await run(readInstalledRecord(path))).toBeUndefined();
  writeFileSync(path, '{broken');
  await expect(run(readInstalledRecord(path))).rejects.toThrow(
    'The installed service record is invalid. Preserve the service directory for manual recovery.',
  );
});

it('reads the saved rollback journal and refuses an invalid installed version', async () => {
  writeFileSync(
    path,
    JSON.stringify({
      installed: { version: '0.1.0' },
      backup: '/tmp/backup',
      target: '0.2.0',
      healthy: false,
    }),
  );
  expect(await run(readUpdateJournal(path))).toEqual({
    installed: { version: '0.1.0' },
    backup: '/tmp/backup',
    target: '0.2.0',
    healthy: false,
  });
  writeFileSync(
    path,
    JSON.stringify({ installed: { version: 1 }, backup: '/tmp/backup' }),
  );
  await expect(run(readUpdateJournal(path))).rejects.toThrow(
    `The interrupted update record at ${path} is invalid. Preserve it and the service runtime for manual recovery.`,
  );
});

it('accepts a known update stage and ignores an unreadable progress record', async () => {
  writeFileSync(
    path,
    JSON.stringify({ from: '0.1.0', target: '0.2.0', stage: 'restarting' }),
  );
  expect(await run(readUpdateRecord(path))).toEqual({
    from: '0.1.0',
    target: '0.2.0',
    stage: 'restarting',
  });
  writeFileSync(
    path,
    JSON.stringify({ from: '0.1.0', target: '0.2.0', stage: 'complete' }),
  );
  expect(await run(readUpdateRecord(path))).toBeUndefined();
});

it('refuses a fractional saved listen port', async () => {
  writeFileSync(
    path,
    JSON.stringify({ dataDirectory: '/tmp/profile', port: 4738.5 }),
  );
  await expect(run(readServiceConfiguration(path))).rejects.toThrow(
    'The saved service configuration is invalid.',
  );
});

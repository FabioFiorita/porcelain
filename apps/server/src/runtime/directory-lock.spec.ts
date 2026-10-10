import { Effect, Exit, Layer, Scope } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { testClock } from '@porcelain/kernel/test-kit';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquireDirectoryLock, directoryLockIsHeld } from './directory-lock.ts';

class HeldError extends Error {}

const roots: string[] = [];
const scopes: Scope.Closeable[] = [];
function takeLock(input: Parameters<typeof acquireDirectoryLock>[0]) {
  const scope = Effect.runSync(Scope.make());
  scopes.push(scope);
  return Effect.runPromise(
    Effect.gen(function* () {
      const services = yield* Layer.build(NodeServices.layer);
      return yield* acquireDirectoryLock(input).pipe(
        Effect.provideContext(services),
      );
    }).pipe(Scope.provide(scope)),
  );
}

function lockPath(): string {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-lock-'));
  roots.push(root);
  return join(root, 'server.lock');
}

async function options(path: string, waitMs = 0) {
  const clock = await testClock('2026-09-24T00:00:00.000Z');
  return {
    path,
    waitMs,
    pollMs: 5,
    staleTakeovers: 3,
    clock,
    held: () => new HeldError(),
  };
}

function leaveLock(path: string, pid: number): void {
  mkdirSync(path);
  writeFileSync(
    join(path, 'owner.json'),
    JSON.stringify({ pid, token: 'left' }),
  );
}

afterEach(async () => {
  for (const scope of scopes.splice(0))
    await Effect.runPromise(Scope.close(scope, Exit.void));
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe('acquireDirectoryLock', () => {
  it('takes a free lock and removes it on release', async () => {
    const path = lockPath();
    const lock = await takeLock(await options(path));
    expect(existsSync(path)).toBe(true);
    await Effect.runPromise(lock.release);
    expect(existsSync(path)).toBe(false);
  });

  it('refuses with the held error while a live process holds the lock', async () => {
    const path = lockPath();
    await takeLock(await options(path));
    await expect(takeLock(await options(path))).rejects.toThrow(HeldError);
  });

  it('takes over a lock whose owner is no longer running', async () => {
    const path = lockPath();
    const exited = spawnSync(process.execPath, ['-e', '']).pid;
    leaveLock(path, exited);
    const lock = await takeLock(await options(path));
    await Effect.runPromise(lock.release);
    expect(existsSync(path)).toBe(false);
  });

  it('waits for a holder that releases within the wait', async () => {
    const path = lockPath();
    const first = await takeLock(await options(path));
    const second = takeLock(await options(path, 500));
    await Effect.runPromise(first.release);
    await expect(second).resolves.toBeDefined();
    expect(existsSync(path)).toBe(true);
  });

  it('never removes a lock another holder took after it', async () => {
    const path = lockPath();
    const first = await takeLock(await options(path));
    rmSync(path, { recursive: true, force: true });
    const second = await takeLock(await options(path));
    await Effect.runPromise(first.release);
    expect(existsSync(path)).toBe(true);
    await Effect.runPromise(second.release);
  });
});

const held = (path: string) =>
  Effect.runPromise(
    directoryLockIsHeld(path).pipe(Effect.provide(NodeServices.layer)),
  );

it('reads an absent lock without creating a directory or claiming ownership', async () => {
  const path = lockPath();
  expect(await held(path)).toBe(false);
  expect(existsSync(path)).toBe(false);
});

it('reads live ownership concurrently without changing it and reports release', async () => {
  const path = lockPath();
  const lock = await takeLock(await options(path));
  const before = readFileSync(join(path, 'owner.json'), 'utf8');
  expect(await Promise.all([held(path), held(path), held(path)])).toEqual([
    true,
    true,
    true,
  ]);
  expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(before);
  expect(readdirSync(path)).toEqual(['owner.json']);
  await Effect.runPromise(lock.release);
  expect(await held(path)).toBe(false);
});

it('reports an exited owner as inactive without deleting its stale lock', async () => {
  const path = lockPath();
  const exited = spawnSync(process.execPath, ['-e', '']).pid;
  leaveLock(path, exited);
  const before = readFileSync(join(path, 'owner.json'), 'utf8');
  expect(await held(path)).toBe(false);
  expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(before);
});

it.each([
  'missing',
  '{broken',
  '{}',
  '{"pid":"wrong","token":"left"}',
  '{"pid":1}',
])(
  'reports %s ownership as inactive without taking the lock',
  async (record) => {
    const path = lockPath();
    mkdirSync(path);
    if (record !== 'missing') writeFileSync(join(path, 'owner.json'), record);
    expect(await held(path)).toBe(false);
    expect(readdirSync(path)).toEqual(
      record === 'missing' ? [] : ['owner.json'],
    );
    if (record !== 'missing')
      expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(record);
  },
);

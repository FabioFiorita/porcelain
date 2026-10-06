import { Effect, Exit, Layer, Scope } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { testClock } from '@porcelain/kernel/test-kit';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquireDirectoryLock } from './directory-lock.ts';

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

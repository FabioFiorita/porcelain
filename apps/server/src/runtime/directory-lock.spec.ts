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

const clock = { now: () => '2026-09-24T00:00:00.000Z' };
const roots: string[] = [];

function lockPath(): string {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-lock-'));
  roots.push(root);
  return join(root, 'server.lock');
}

function options(path: string, waitMs = 0) {
  return { path, waitMs, pollMs: 5, clock, held: () => new HeldError() };
}

function leaveLock(path: string, pid: number): void {
  mkdirSync(path);
  writeFileSync(
    join(path, 'owner.json'),
    JSON.stringify({ pid, token: 'left' }),
  );
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe('acquireDirectoryLock', () => {
  it('takes a free lock and removes it on release', async () => {
    const path = lockPath();
    const lock = await acquireDirectoryLock(options(path));
    expect(existsSync(path)).toBe(true);
    await lock.release();
    expect(existsSync(path)).toBe(false);
  });

  it('refuses with the held error while a live process holds the lock', async () => {
    const path = lockPath();
    await acquireDirectoryLock(options(path));
    await expect(acquireDirectoryLock(options(path))).rejects.toThrow(
      HeldError,
    );
  });

  it('takes over a lock whose owner is no longer running', async () => {
    const path = lockPath();
    const exited = spawnSync(process.execPath, ['-e', '']).pid;
    leaveLock(path, exited);
    const lock = await acquireDirectoryLock(options(path));
    await lock.release();
    expect(existsSync(path)).toBe(false);
  });

  it('waits for a holder that releases within the wait', async () => {
    const path = lockPath();
    const first = await acquireDirectoryLock(options(path));
    const second = acquireDirectoryLock(options(path, 500));
    await first.release();
    await expect(second).resolves.toBeDefined();
  });

  it('never removes a lock another holder took after it', async () => {
    const path = lockPath();
    const first = await acquireDirectoryLock(options(path));
    rmSync(path, { recursive: true, force: true });
    const second = await acquireDirectoryLock(options(path));
    await first.release();
    expect(existsSync(path)).toBe(true);
    await second.release();
  });
});

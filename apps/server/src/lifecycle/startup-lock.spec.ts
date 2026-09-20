import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { acquireStartupLock } from './startup-lock.ts';

const driver = createRequire(import.meta.url).resolve('better-sqlite3');

/**
 * Take the same file lock from another process and die without releasing it.
 * This is what a crash mid-startup looks like from the next starter's side.
 */
function crashWhileHolding(directory: string) {
  expect(() =>
    execFileSync(
      process.execPath,
      [
        '-e',
        `const Database = require(${JSON.stringify(driver)});
         const db = new Database(${JSON.stringify(join(directory, 'startup.lock'))});
         db.pragma('busy_timeout = 0');
         db.exec('BEGIN EXCLUSIVE');
         process.kill(process.pid, 'SIGKILL');`,
      ],
      { stdio: 'ignore' },
    ),
  ).toThrow();
}

it('excludes a second starter and is released by the kernel after a crash', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-startup-lock-'));
  try {
    const held = await acquireStartupLock(directory);
    // A contender does not get in, and gives up rather than waiting forever.
    await expect(acquireStartupLock(directory, 100)).rejects.toBeInstanceOf(
      DataDirectoryOwnedError,
    );
    held.release();
    const next = await acquireStartupLock(directory, 100);
    next.release();

    crashWhileHolding(directory);
    // No cleanup step runs in between: the lock a dead process held is free.
    const afterCrash = await acquireStartupLock(directory, 100);
    afterCrash.release();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('releases only once however often it is asked', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-startup-lock-'));
  try {
    const held = await acquireStartupLock(directory);
    held.release();
    held.release();
    const next = await acquireStartupLock(directory, 100);
    next.release();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

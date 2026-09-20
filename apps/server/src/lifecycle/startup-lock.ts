import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';

const pollMs = 25;

export type StartupLock = { release(): void };

/**
 * Serialize startup so that only one starter at a time decides whether the
 * owner socket is stale, removes it and binds its own.  Without this, two
 * starters can both find a dead socket and the second unlinks the first one's
 * live socket — and no probe can tell a crashed starter from a live one that
 * has not bound yet.
 *
 * Node exposes no `flock`, so the lock is an exclusive SQLite transaction on a
 * file used for nothing else.  SQLite locks through `fcntl`, which the kernel
 * releases when the holder dies, so a crash mid-startup leaves nothing to clean
 * up by hand — the property the removed `server.lock` never had.
 */
export async function acquireStartupLock(
  directory: string,
  waitMs = 10_000,
): Promise<StartupLock> {
  const database = new Database(join(directory, 'startup.lock'));
  // Poll rather than let SQLite wait: its wait is synchronous and would stall
  // this process's event loop, including whatever else is starting up.
  database.pragma('busy_timeout = 0');
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      database.exec('BEGIN EXCLUSIVE');
      break;
    } catch (error) {
      if (Date.now() >= deadline) {
        database.close();
        throw new DataDirectoryOwnedError(directory, error);
      }
      await delay(pollMs);
    }
  }
  const state = { released: false };
  return {
    release: () => {
      if (state.released) return;
      state.released = true;
      // Closing the connection rolls back and drops the file lock.
      database.close();
    },
  };
}

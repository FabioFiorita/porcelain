import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';

const pollMs = 25;

export type StartupLock = { release(): void };

export async function acquireStartupLock(
  directory: string,
  waitMs = 10_000,
): Promise<StartupLock> {
  const database = new Database(join(directory, 'startup.lock'));
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
      database.close();
    },
  };
}

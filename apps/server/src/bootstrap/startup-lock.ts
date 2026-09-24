import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import type { MonotonicClock } from '../ports/monotonic-clock.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';

const POLL_MS = 25;
const WAIT_MS = 10_000;

export type StartupLock = { release(): void };

export async function acquireStartupLock(
  directory: string,
  clock: MonotonicClock,
): Promise<StartupLock> {
  const database = new Database(join(directory, 'startup.lock'));
  database.pragma('busy_timeout = 0');
  const deadline = clock.elapsedMs() + WAIT_MS;
  for (;;) {
    try {
      database.exec('BEGIN EXCLUSIVE');
      break;
    } catch (error) {
      if (clock.elapsedMs() >= deadline) {
        database.close();
        throw new DataDirectoryOwnedError(directory, error);
      }
      await delay(POLL_MS);
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

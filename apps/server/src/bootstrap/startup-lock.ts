import { join } from 'node:path';
import Database from 'better-sqlite3';
import { delay } from '../runtime/delay.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';

const POLL_MS = 25;
const POLLS = 400;

export type StartupLock = { release(): void };

export async function acquireStartupLock(
  directory: string,
): Promise<StartupLock> {
  const database = new Database(join(directory, 'startup.lock'));
  database.pragma('busy_timeout = 0');
  for (let poll = 1; ; poll += 1) {
    try {
      database.exec('BEGIN EXCLUSIVE');
      break;
    } catch (error) {
      if (poll >= POLLS) {
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

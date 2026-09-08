import {
  closeSync,
  mkdirSync,
  openSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';

export function claimDataDirectory(dataDirectory: string) {
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const directory = realpathSync(dataDirectory);
  const path = join(directory, 'server.lock');
  const descriptor = openOwnershipFile(path);
  try {
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid })}\n`);
  } catch (error) {
    unlinkSync(path);
    throw error;
  } finally {
    closeSync(descriptor);
  }
  const state = { released: false };
  return {
    directory,
    release: () => {
      if (state.released) return;
      unlinkSync(path);
      state.released = true;
    },
  };
}

function openOwnershipFile(path: string) {
  try {
    return openSync(path, 'wx', 0o600);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new DataDirectoryOwnedError(error);
    }
    throw error;
  }
}

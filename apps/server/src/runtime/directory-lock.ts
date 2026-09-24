import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Clock } from '@porcelain/kernel/ports';
import { delay } from './delay.ts';

export type DirectoryLockOptions = {
  path: string;
  waitMs: number;
  pollMs: number;
  staleTakeovers: number;
  clock: Clock;
  held: () => Error;
};

export type DirectoryLock = { release(): Promise<void> };

type LockOwner = { pid: number; token: string };

const OWNER_FILE = 'owner.json';

function errorCode(error: unknown): unknown {
  return error instanceof Error && 'code' in error ? error.code : undefined;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === 'EPERM';
  }
}

async function ownerOf(lock: string): Promise<LockOwner | undefined> {
  let owner: unknown;
  try {
    owner = JSON.parse(await readFile(join(lock, OWNER_FILE), 'utf8'));
  } catch {
    return undefined;
  }
  return typeof owner === 'object' &&
    owner !== null &&
    'pid' in owner &&
    typeof owner.pid === 'number' &&
    'token' in owner &&
    typeof owner.token === 'string'
    ? { pid: owner.pid, token: owner.token }
    : undefined;
}

async function isStale(lock: string): Promise<boolean> {
  const owner = await ownerOf(lock);
  return owner === undefined || !processIsAlive(owner.pid);
}

async function claim(
  candidate: string,
  options: DirectoryLockOptions,
): Promise<void> {
  let waited = 0;
  let takeovers = 0;
  for (;;) {
    try {
      await rename(candidate, options.path);
      return;
    } catch (error) {
      const code = errorCode(error);
      if (code !== 'EEXIST' && code !== 'ENOTEMPTY') throw error;
    }
    if (takeovers < options.staleTakeovers && (await isStale(options.path))) {
      takeovers += 1;
      await rm(options.path, { recursive: true, force: true });
      continue;
    }
    if (waited >= options.waitMs) throw options.held();
    await delay(options.pollMs);
    waited += options.pollMs;
  }
}

export async function acquireDirectoryLock(
  options: DirectoryLockOptions,
): Promise<DirectoryLock> {
  await mkdir(dirname(options.path), { recursive: true, mode: 0o700 });
  const token = randomUUID();
  const candidate = `${options.path}.candidate-${token}`;
  await mkdir(candidate, { mode: 0o700 });
  try {
    await writeFile(
      join(candidate, OWNER_FILE),
      JSON.stringify({
        pid: process.pid,
        createdAt: options.clock.now(),
        token,
      }),
      { mode: 0o600 },
    );
    await claim(candidate, options);
  } catch (error) {
    await rm(candidate, { recursive: true, force: true });
    throw error;
  }
  return {
    release: async () => {
      const owner = await ownerOf(options.path);
      if (owner?.token === token)
        await rm(options.path, { recursive: true, force: true });
    },
  };
}

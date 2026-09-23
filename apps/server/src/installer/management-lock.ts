import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ManagementLockHeldError } from './errors/management-lock-held-error.ts';
import { ManagementLockUnavailableError } from './errors/management-lock-unavailable-error.ts';
import { errorCode, readJsonFile } from './json-file.ts';
import { lockOwnerSchema } from './records.ts';

const attempts = 3;

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === 'EPERM';
  }
}

async function lockIsStale(lock: string): Promise<boolean> {
  const owner = await readJsonFile(join(lock, 'owner.json'), lockOwnerSchema);
  return owner.kind !== 'value' || !processIsAlive(owner.value.pid);
}

export async function acquireManagementLock(
  root: string,
): Promise<() => Promise<void>> {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lock = join(root, 'management.lock');
  const token = randomUUID();
  const candidate = `${lock}.candidate-${token}`;
  await mkdir(candidate, { mode: 0o700 });
  await writeFile(
    join(candidate, 'owner.json'),
    `${JSON.stringify({ pid: process.pid, createdAt: Date.now(), token })}\n`,
    { mode: 0o600 },
  );
  const release = async () => {
    const owner = await readJsonFile(join(lock, 'owner.json'), lockOwnerSchema);
    if (owner.kind === 'value' && owner.value.token === token)
      await rm(lock, { recursive: true, force: true });
  };
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        await rename(candidate, lock);
        return release;
      } catch (error) {
        const code = errorCode(error);
        if (code !== 'EEXIST' && code !== 'ENOTEMPTY') throw error;
        if (!(await lockIsStale(lock))) throw new ManagementLockHeldError();
        await rm(lock, { recursive: true, force: true });
      }
    }
    throw new ManagementLockUnavailableError();
  } catch (error) {
    await rm(candidate, { recursive: true, force: true });
    throw error;
  }
}

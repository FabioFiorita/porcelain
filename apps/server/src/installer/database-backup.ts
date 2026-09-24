import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { exists } from './json-file.ts';

const DATABASE_FILES = [
  'inventory.sqlite',
  'inventory.sqlite-wal',
  'inventory.sqlite-shm',
];

export function backupLocation(
  root: string,
  now: string,
  label: string,
): string {
  const stamp = now.replaceAll(':', '-');
  return join(root, `${stamp}-${label}-${randomUUID()}`);
}

export async function backupDatabase(
  dataDirectory: string,
  destination: string,
): Promise<void> {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  for (const file of DATABASE_FILES) {
    const source = join(dataDirectory, file);
    if (await exists(source)) await copyFile(source, join(destination, file));
  }
}

export async function restoreDatabase(
  dataDirectory: string,
  backup: string,
): Promise<void> {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  for (const file of DATABASE_FILES) {
    await rm(join(dataDirectory, file), { force: true });
    const source = join(backup, file);
    if (await exists(source)) await copyFile(source, join(dataDirectory, file));
  }
}

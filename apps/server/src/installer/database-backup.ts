import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { databaseFiles } from '@porcelain/storage';
import { exists } from './json-file.ts';

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
  for (const file of databaseFiles) {
    const source = join(dataDirectory, file);
    if (await exists(source)) await copyFile(source, join(destination, file));
  }
}

export async function restoreDatabase(
  dataDirectory: string,
  backup: string,
): Promise<void> {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  for (const file of databaseFiles) {
    await rm(join(dataDirectory, file), { force: true });
    const source = join(backup, file);
    if (await exists(source)) await copyFile(source, join(dataDirectory, file));
  }
}

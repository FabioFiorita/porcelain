import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { UnsupportedFilesystemIdentityError } from './errors/unsupported-filesystem-identity-error.ts';

export async function identity(path: string): Promise<string> {
  const info = await stat(path, { bigint: true });
  if (info.birthtimeNs === 0n) throw new UnsupportedFilesystemIdentityError();
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}

export async function readGitdirPointer(
  administrativeDirectory: string,
): Promise<string | null> {
  let pointer: string;
  try {
    pointer = (
      await readFile(join(administrativeDirectory, 'gitdir'), 'utf8')
    ).trim();
  } catch {
    return null;
  }
  if (pointer === '') return null;
  const target = isAbsolute(pointer)
    ? pointer
    : resolve(administrativeDirectory, pointer);
  return resolve(target, '..');
}

export async function readHead(
  administrativeDirectory: string,
): Promise<string | null> {
  try {
    const head = (
      await readFile(join(administrativeDirectory, 'HEAD'), 'utf8')
    ).trim();
    return head.startsWith('ref: ') ? head.slice(5) : null;
  } catch {
    return null;
  }
}

export async function readWorktreeRegistry(
  commonDirectory: string,
): Promise<Map<string, string>> {
  const root = join(commonDirectory, 'worktrees');
  let names: string[];
  try {
    names = await readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return new Map();
  }
  const registry = new Map<string, string>();
  for (const name of names) {
    const administrativeDirectory = join(root, name);
    const checkout = await readGitdirPointer(administrativeDirectory);
    if (!checkout) continue;
    registry.set(await realpathOrSelf(checkout), administrativeDirectory);
  }
  return registry;
}

export async function realpathOrSelf(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

export async function contained(
  administrativeDirectory: string,
  commonDirectory: string,
): Promise<boolean> {
  if (administrativeDirectory === commonDirectory) return true;
  try {
    const root = await realpath(join(commonDirectory, 'worktrees'));
    const real = await realpath(administrativeDirectory);
    return real.startsWith(`${root}${sep}`);
  } catch {
    return false;
  }
}

export async function corroborates(
  path: string,
  administrativeDirectory: string,
): Promise<boolean> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(join(path, '.git'));
  } catch {
    return false;
  }
  if (info.isDirectory())
    return (
      (await realpathOrSelf(join(path, '.git'))) ===
      (await realpathOrSelf(administrativeDirectory))
    );
  try {
    const pointer = (await readFile(join(path, '.git'), 'utf8')).trim();
    if (!pointer.startsWith('gitdir:')) return false;
    const target = pointer.slice('gitdir:'.length).trim();
    const resolved = isAbsolute(target) ? target : resolve(path, target);
    return (
      (await realpathOrSelf(resolved)) ===
      (await realpathOrSelf(administrativeDirectory))
    );
  } catch {
    return false;
  }
}

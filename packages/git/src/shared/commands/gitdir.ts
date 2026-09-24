import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { isMissing } from '../errors/is-missing.ts';

export function parseGitdirFile(text: string): string | undefined {
  const pointer = text.trim();
  if (!pointer.startsWith('gitdir:')) return undefined;
  const target = pointer.slice('gitdir:'.length).trim();
  return target === '' || /[\0\r\n]/u.test(target) ? undefined : target;
}

export async function readGitDirectory(
  checkout: string,
): Promise<string | undefined> {
  const dotGit = join(checkout, '.git');
  if ((await stat(dotGit)).isDirectory()) return dotGit;
  const target = parseGitdirFile(await readFile(dotGit, 'utf8'));
  return target === undefined ? undefined : resolve(checkout, target);
}

export async function readCommonDirectory(
  gitDirectory: string,
): Promise<string> {
  try {
    const target = (
      await readFile(join(gitDirectory, 'commondir'), 'utf8')
    ).trim();
    return resolve(gitDirectory, target);
  } catch (error) {
    if (isMissing(error)) return gitDirectory;
    throw error;
  }
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
  return resolve(administrativeDirectory, pointer, '..');
}

export async function readWorktreeRegistry(
  commonDirectory: string,
): Promise<Map<string, string>> {
  const root = join(commonDirectory, 'worktrees');
  let names: string[];
  try {
    names = await readdir(root);
  } catch (error) {
    if (!isMissing(error)) throw error;
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
  try {
    const gitDirectory = await readGitDirectory(path);
    return (
      gitDirectory !== undefined &&
      (await realpathOrSelf(gitDirectory)) ===
        (await realpathOrSelf(administrativeDirectory))
    );
  } catch {
    return false;
  }
}

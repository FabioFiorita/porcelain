import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { UnsupportedFilesystemIdentityError } from './errors/unsupported-filesystem-identity-error.ts';

export async function identity(path: string): Promise<string> {
  const info = await stat(path, { bigint: true });
  if (info.birthtimeNs === 0n) throw new UnsupportedFilesystemIdentityError();
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}

/**
 * Where a linked worktree's checkout currently is, according to the repository
 * rather than the checkout.
 *
 * `git worktree move` rewrites this file and leaves the administrative
 * directory where it was, which is why identity comes from the directory and
 * the path comes from here.
 */
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
  // The pointer names the checkout's `.git` file; its parent is the checkout.
  const target = isAbsolute(pointer)
    ? pointer
    : resolve(administrativeDirectory, pointer);
  return resolve(target, '..');
}

/** The checked-out branch, read from the administrative directory's HEAD. */
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

/**
 * Every administrative directory this repository owns, by the real path of the
 * checkout it currently points at.
 *
 * Enumerating the registry rather than asking each checkout costs no Git
 * processes and keeps working while a checkout is unreachable.
 */
export async function readWorktreeRegistry(
  commonDirectory: string,
): Promise<Map<string, string>> {
  const root = join(commonDirectory, 'worktrees');
  let names: string[];
  try {
    names = await readdir(root);
  } catch (error) {
    // A repository with no linked worktree has no registry at all. Anything
    // else — a permission problem, an I/O error — is not the same statement:
    // reporting it as "no linked worktrees" would be a listing that looks
    // complete while every linked worktree is missing from it.
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
    // Unreachable checkouts still have to match the list Git printed.
    return path;
  }
}

/**
 * The administrative directory must be the common directory itself or live
 * directly beneath its real `worktrees/` directory. A pointer that escapes
 * would let one repository claim another's identities.
 */
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

/**
 * Whether the checkout at `path` still belongs to this administrative
 * directory, according to the checkout itself.
 *
 * Identity comes from the repository side, which keeps working while a
 * checkout is unplugged. But when the checkout *is* readable it gets a vote:
 * a different repository cloned over that path has its own `.git`, and
 * without this it would be inspected as though it were the worktree the id
 * names.
 */
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
    // A main worktree: its `.git` is the administrative directory itself.
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

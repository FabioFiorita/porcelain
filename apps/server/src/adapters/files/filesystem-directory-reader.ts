import type { Dirent } from 'node:fs';
import { lstat, opendir, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DirectoryEntry,
  DirectoryRead,
  EntryKind,
  FileLocation,
} from '@porcelain/files/models';
import type { DirectoryReader } from '@porcelain/files/ports';
import { filesystemFailure, inspectPath, verifyPath } from './inspect-path.ts';
import {
  knownWorktree,
  type KnownWorktrees,
} from '../projects/checkout-session.ts';

const nameDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export class FilesystemDirectoryReader implements DirectoryReader {
  private readonly worktrees: KnownWorktrees;

  constructor(worktrees: KnownWorktrees) {
    this.worktrees = worktrees;
  }

  async list(
    location: FileLocation,
    maxEntries: number,
    signal?: AbortSignal,
  ): Promise<DirectoryRead> {
    const checkout = await knownWorktree(
      this.worktrees,

      location.worktreeId,
      signal,
    );
    const target = { root: checkout.path, path: location.path };
    try {
      const before = await inspectPath(target, signal);
      if (!before.info.isDirectory())
        return { kind: 'failed', failure: 'unreadable' };
      const found: { name: string; entry: Dirent }[] = [];
      for await (const entry of await opendir(before.path, {
        encoding: 'buffer',
      })) {
        signal?.throwIfAborted();
        const name = decodedName(entry.name);
        if (name === undefined)
          return { kind: 'failed', failure: 'unsupported-name' };
        if (name.toLowerCase() === '.git') continue;
        if (found.length === maxEntries) return { kind: 'too-large' };
        found.push({ name, entry });
      }
      const entries: DirectoryEntry[] = [];
      for (const { name, entry } of found)
        entries.push(await describe(before.path, name, entry, signal));
      await verifyPath(before, target, signal);
      return { kind: 'directory', entries };
    } catch (error) {
      const failure = filesystemFailure(error);
      if (failure === undefined) throw error;
      return { kind: 'failed', failure };
    }
  }
}

function decodedName(name: unknown) {
  if (!(name instanceof Uint8Array))
    throw new TypeError('Expected a raw directory name');
  try {
    return nameDecoder.decode(name);
  } catch {
    return undefined;
  }
}

async function describe(
  directory: string,
  name: string,
  entry: Dirent,
  signal?: AbortSignal,
): Promise<DirectoryEntry> {
  signal?.throwIfAborted();
  const kind = entryKind(entry);
  const full = join(directory, name);
  if (kind === 'symlink') {
    const target = await readlink(full).catch(() => undefined);
    return target === undefined ? { name, kind } : { name, kind, target };
  }
  if (kind === 'directory') {
    const nested = await lstat(join(full, '.git')).then(
      () => true,
      () => false,
    );
    return { name, kind: nested ? 'submodule' : kind };
  }
  return { name, kind };
}

function entryKind(entry: Dirent): EntryKind {
  if (entry.isSymbolicLink()) return 'symlink';
  if (entry.isDirectory()) return 'directory';
  if (entry.isFile()) return 'file';
  return 'other';
}

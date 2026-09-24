import type { Dirent } from 'node:fs';
import { lstat, opendir, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DirectoryEntry,
  DirectoryRead,
  DirectoryReadInput,
  EntryKind,
} from '@porcelain/files/models';
import type { DirectoryReader } from '@porcelain/files/ports';
import { inspectPath, readFailure, verifyPath } from './inspect-path.ts';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

const nameDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export class FilesystemDirectoryReader implements DirectoryReader {
  private readonly worktrees: ListedWorktrees;

  constructor(worktrees: ListedWorktrees) {
    this.worktrees = worktrees;
  }

  async list(
    input: DirectoryReadInput,
    signal?: AbortSignal,
  ): Promise<DirectoryRead> {
    const checkout = await listedWorktree(
      this.worktrees,
      input.worktreeId,
      signal,
    );
    const target = { root: checkout.path, path: input.path };
    try {
      const before = await inspectPath(target, signal);
      if (!before.info.isDirectory())
        return { kind: 'failed', failure: 'unreadable' };
      const found: { name: string; entry: Dirent }[] = [];
      let truncated = false;
      for await (const entry of await opendir(before.path, {
        encoding: 'buffer',
      })) {
        signal?.throwIfAborted();
        const name = decodedName(entry.name);
        if (name === undefined)
          return { kind: 'failed', failure: 'unsupported-name' };
        if (found.length === input.limit) {
          truncated = true;
          break;
        }
        found.push({ name, entry });
      }
      const entries: DirectoryEntry[] = [];
      for (const { name, entry } of found)
        entries.push(await describe(before.path, name, entry, signal));
      await verifyPath(before, target, signal);
      return { kind: 'listed', entries, truncated };
    } catch (error) {
      const failure = readFailure(error);
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

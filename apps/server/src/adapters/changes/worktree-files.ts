import { createHash } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { constants } from 'node:fs';
import { lstat, open, readlink } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import type { WorktreeEntry } from '@porcelain/changes/models';
import {
  inspectPath,
  readFailure,
  sameFile,
  unchanged,
  verifyPath,
} from '../files/inspect-path.ts';

export type WorktreeReadOptions = { chunkBytes: number; concurrency: number };

export async function readWorktreeFiles(
  root: string,
  paths: readonly string[],
  maxDigestBytes: number,
  options: WorktreeReadOptions,
): Promise<Map<string, WorktreeEntry>> {
  const entries = new Map<string, WorktreeEntry>();
  const wanted = [...new Set(paths)];
  let next = 0;
  const worker = async () => {
    while (next < wanted.length) {
      const path = wanted[next];
      next += 1;
      if (path === undefined) continue;
      try {
        const entry = await readEntry(
          root,
          path,
          maxDigestBytes,
          options.chunkBytes,
        );
        if (entry) entries.set(path, entry);
      } catch (error) {
        if (readFailure(error) !== 'missing')
          entries.set(path, { kind: 'unreadable' });
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(options.concurrency, wanted.length) },
      worker,
    ),
  );
  return entries;
}

async function readEntry(
  root: string,
  path: string,
  maxDigestBytes: number,
  chunkBytes: number,
): Promise<WorktreeEntry | undefined> {
  if (path === '' || path.split('/').some((part) => part === '..'))
    return undefined;
  const parent = dirname(path);
  const target = { worktreeId: '', root, path: parent === '.' ? '' : parent };
  const before = await inspectPath(target);
  if (!before.info.isDirectory()) return undefined;
  const full = join(before.path, path.split('/').at(-1) ?? '');
  if (!full.startsWith(before.path + sep)) return undefined;
  const info = await lstat(full, { bigint: true });
  if (info.isSymbolicLink()) {
    const link = await readlink(full);
    await verifyPath(before, target);
    return { kind: 'symlink', target: link, stamp: stampOf(info) };
  }
  if (!info.isFile()) return { kind: 'other' };
  const read = await digestFile(full, info, maxDigestBytes, chunkBytes);
  if (read.kind === 'file') await verifyPath(before, target);
  return read;
}

function stampOf(info: BigIntStats) {
  return [info.dev, info.ino, info.size, info.ctimeNs, info.mode].join(':');
}

export async function stampPath(path: string): Promise<string | undefined> {
  try {
    return stampOf(await lstat(path, { bigint: true }));
  } catch {
    return undefined;
  }
}

async function digestFile(
  full: string,
  classified: BigIntStats,
  maxBytes: number,
  chunkBytes: number,
): Promise<WorktreeEntry> {
  const handle = await open(
    full,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(classified, opened))
      return { kind: 'other' };
    if (opened.size > BigInt(maxBytes)) return { kind: 'too-large' };
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(chunkBytes);
    let read = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, read);
      if (bytesRead === 0) break;
      read += bytesRead;
      if (read > maxBytes) return { kind: 'too-large' };
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await handle.stat({ bigint: true });
    if (!unchanged(opened, after)) return { kind: 'other' };
    return { kind: 'file', digest: hash.digest('hex'), stamp: stampOf(after) };
  } finally {
    await handle.close();
  }
}

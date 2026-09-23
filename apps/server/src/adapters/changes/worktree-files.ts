import { createHash } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { constants } from 'node:fs';
import { lstat, open, readlink } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import type { WorktreeEntry } from '@porcelain/changes/models';
import {
  inspectPath,
  sameFile,
  unchanged,
  verifyPath,
} from '../files/inspect-path.ts';

export type WorktreeFiles = (
  root: string,
  paths: readonly string[],
) => Promise<Map<string, WorktreeEntry>>;

export type StampPath = (path: string) => Promise<string | null>;

const MAX_DIGEST_BYTES = 64 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;
const CONCURRENT_READS = 8;

export const readWorktreeFiles: WorktreeFiles = async (root, paths) => {
  const entries = new Map<string, WorktreeEntry>();
  const wanted = [...new Set(paths)];
  let next = 0;
  const worker = async () => {
    while (next < wanted.length) {
      const path = wanted[next];
      next += 1;
      if (path === undefined) continue;
      try {
        const entry = await readEntry(root, path);
        if (entry) entries.set(path, entry);
      } catch {}
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENT_READS, wanted.length) }, worker),
  );
  return entries;
};

async function readEntry(
  root: string,
  path: string,
): Promise<WorktreeEntry | null> {
  if (path === '' || path.split('/').some((part) => part === '..')) return null;
  const parent = dirname(path);
  const target = { worktreeId: '', root, path: parent === '.' ? '' : parent };
  const before = await inspectPath(target);
  if (!before.info.isDirectory()) return null;
  const full = join(before.path, path.split('/').at(-1) ?? '');
  if (!full.startsWith(before.path + sep)) return null;
  const info = await lstat(full, { bigint: true });
  if (info.isSymbolicLink()) {
    const link = await readlink(full);
    await verifyPath(before, target);
    return { kind: 'symlink', target: link, stamp: stampOf(info) };
  }
  if (!info.isFile()) return { kind: 'other' };
  const read = await digestFile(full, info);
  if (read === null) return { kind: 'other' };
  await verifyPath(before, target);
  return { kind: 'file', ...read };
}

function stampOf(info: BigIntStats) {
  return [info.dev, info.ino, info.size, info.ctimeNs, info.mode].join(':');
}

export const stampPath: StampPath = async (path) => {
  try {
    return stampOf(await lstat(path, { bigint: true }));
  } catch {
    return null;
  }
};

async function digestFile(full: string, classified: BigIntStats) {
  const handle = await open(
    full,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(classified, opened)) return null;
    if (opened.size > BigInt(MAX_DIGEST_BYTES)) return null;
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(CHUNK_BYTES);
    let read = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, read);
      if (bytesRead === 0) break;
      read += bytesRead;
      if (read > MAX_DIGEST_BYTES) return null;
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await handle.stat({ bigint: true });
    if (!unchanged(opened, after)) return null;
    return { digest: hash.digest('hex'), stamp: stampOf(after) };
  } finally {
    await handle.close();
  }
}

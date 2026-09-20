import { createHash } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { constants } from 'node:fs';
import { lstat, open, readlink } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import {
  inspectPath,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import type {
  StampPath,
  WorktreeEntry,
  WorktreeFiles,
} from './interfaces/worktree-files.ts';

/**
 * A working file is hashed in fixed-size chunks, so the cost of a change list
 * is bounded by bytes read rather than by the largest file in it. Past this a
 * file has no digest, which makes it unmarkable — honest, and the same answer
 * the read it replaced gave for content it could not bound.
 */
const MAX_DIGEST_BYTES = 64 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;
/**
 * A worktree may hold two thousand changed files. Reading all of them at once
 * would open two thousand handles and hold that many chunks of memory, so a
 * few are in flight at a time and the rest wait.
 */
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
      } catch {
        // Unreadable: no entry, so nothing about it can be marked reviewed.
      }
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
  // Every ancestor is checked the way every other file read checks it: a real
  // directory, not a link, and unchanged by the time the read finishes.
  const parent = dirname(path);
  const target = { worktreeId: '', root, path: parent === '.' ? '' : parent };
  const before = await inspectPath(target);
  if (!before.info.isDirectory()) return null;
  const full = join(before.path, path.split('/').at(-1) ?? '');
  if (!full.startsWith(before.path + sep)) return null;
  const info = (await lstat(full, { bigint: true })) as BigIntStats;
  // The link itself is the change. Reading what it points at would leave the
  // checkout and could read anything on the machine.
  if (info.isSymbolicLink()) {
    const link = await readlink(full);
    // Checking the ancestors and then reading is two moments. Anything that
    // replaced one of them in between — a directory swapped for a link out of
    // the checkout — would have redirected this read, so they are checked
    // again now that it is done.
    await verifyPath(before, target);
    return { kind: 'symlink', target: link, stamp: stampOf(info) };
  }
  if (!info.isFile()) return { kind: 'other' };
  const read = await digestFile(full, info);
  if (read === null) return { kind: 'other' };
  await verifyPath(before, target);
  return { kind: 'file', ...read };
}

/** Identity, size and change time: what a write moves and cannot move back. */
function stampOf(info: BigIntStats) {
  return [info.dev, info.ino, info.size, info.ctimeNs, info.mode].join(':');
}

export const stampPath: StampPath = async (path) => {
  try {
    return stampOf((await lstat(path, { bigint: true })) as BigIntStats);
  } catch {
    return null;
  }
};

/**
 * Opened without following the final component and checked against the entry
 * that was classified, so a regular file cannot become a symlink or a FIFO
 * between deciding what it is and reading it.
 */
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
    // A file rewritten while it was being read is not a state anyone saw.
    const after = (await handle.stat({ bigint: true })) as BigIntStats;
    if (!unchanged(opened, after)) return null;
    return { digest: hash.digest('hex'), stamp: stampOf(after) };
  } finally {
    await handle.close();
  }
}

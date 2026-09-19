import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileStamps } from './interfaces/file-stamps.ts';

export const readFileStamps: FileStamps = async (root, paths) => {
  const stamps = await Promise.all(
    paths.map(async (path) => {
      try {
        const info = await lstat(join(root, path), { bigint: true });
        // A second write within the timestamp tick would leave the stamp unchanged.
        if (BigInt(Date.now()) * 1_000_000n - info.mtimeNs < 2_000_000_000n)
          return `recent:${process.hrtime.bigint()}`;
        return `${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
      } catch {
        return 'missing';
      }
    }),
  );
  return stamps.join('\n');
};

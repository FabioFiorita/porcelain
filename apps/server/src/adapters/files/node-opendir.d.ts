import type { Dir, OpenDirOptions, PathLike } from 'node:fs';

declare module 'node:fs/promises' {
  function opendir(
    path: PathLike,
    options: Omit<OpenDirOptions, 'encoding'> & { encoding: 'buffer' },
  ): Promise<Dir>;
}

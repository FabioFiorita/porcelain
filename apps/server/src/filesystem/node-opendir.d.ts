import type { Dir, OpenDirOptions, PathLike } from 'node:fs';

// Node supports raw directory-name buffers, but @types/node 24 omits this
// encoding from opendir. Keep the overload narrow; decodeDirectoryName validates
// the actual Buffer at runtime because Dir also assumes string names.
declare module 'node:fs/promises' {
  function opendir(
    path: PathLike,
    options: Omit<OpenDirOptions, 'encoding'> & { encoding: 'buffer' },
  ): Promise<Dir>;
}

import { FILE_QUICK_OPEN_MAX } from '../../../config/limits.ts';
import { relativePathSchema } from '@porcelain/contracts/shared';
import * as Schema from 'effect/Schema';

export function quickOpenPath(query: string): string | null {
  const path = query.trim();
  if (!path.includes('/') && !path.startsWith('.')) return null;
  const decoded = Schema.decodeUnknownOption(relativePathSchema)(path);
  return decoded._tag === 'Some' ? decoded.value : null;
}

export function quickOpenMatches(paths: readonly string[], query: string) {
  const needle = query.trim().toLowerCase();
  return paths
    .filter((path) => path.toLowerCase().includes(needle))
    .map((path) => {
      const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
      const rank =
        name === needle
          ? 0
          : name.startsWith(needle)
            ? 1
            : name.includes(needle)
              ? 2
              : 3;
      return { path, rank };
    })
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.path.length - right.path.length ||
        (left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    )
    .slice(0, FILE_QUICK_OPEN_MAX)
    .map(({ path }) => path);
}

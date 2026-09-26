import type { FileChange } from '@porcelain/kernel/models';

export function changedPaths(change: FileChange): string[] {
  return [
    change.path,
    ...change.comparisons.flatMap((comparison) =>
      'path' in comparison
        ? [comparison.path]
        : [comparison.oldPath, comparison.newPath].filter(
            (path): path is string => path !== undefined,
          ),
    ),
  ];
}

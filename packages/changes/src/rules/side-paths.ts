import type { ChangeComparison } from '../models/change.ts';
import type { SidePaths } from '../models/worktree-side.ts';

const SUBMODULE_MODE = '160000';

export function sidePaths(comparisons: readonly ChangeComparison[]): SidePaths {
  const submodule = new Map<string, boolean>();
  for (const comparison of comparisons) {
    if (comparison.scope === 'untracked' || comparison.scope === 'unmerged')
      submodule.set(comparison.path, false);
    else if (
      comparison.scope === 'unstaged' &&
      comparison.kind !== 'deleted' &&
      comparison.newPath !== undefined
    )
      submodule.set(comparison.newPath, comparison.newMode === SUBMODULE_MODE);
  }
  const paths = [...submodule];
  return {
    files: paths.flatMap(([path, gitlink]) => (gitlink ? [] : [path])),
    submodules: paths.flatMap(([path, gitlink]) => (gitlink ? [path] : [])),
  };
}

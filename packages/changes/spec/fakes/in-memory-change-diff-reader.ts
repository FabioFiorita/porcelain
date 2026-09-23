import type {
  ChangeDiffContent,
  TrackedComparison,
} from '@porcelain/changes/models';
import type { ChangeDiffReader } from '@porcelain/changes/ports';

export class InMemoryChangeDiffReader implements ChangeDiffReader {
  readonly patches = new Map<string, string>();
  dropLast = false;

  readDiffs(
    _worktreeId: string,
    comparisons: readonly TrackedComparison[],
  ): Promise<ChangeDiffContent[]> {
    const contents = comparisons.map((comparison): ChangeDiffContent => {
      const patch = this.patches.get(
        `${comparison.scope}:${comparison.newPath ?? comparison.oldPath ?? ''}`,
      );
      return patch === undefined
        ? { kind: 'metadata-only', patch: '' }
        : { kind: 'text', patch };
    });
    return Promise.resolve(this.dropLast ? contents.slice(0, -1) : contents);
  }
}

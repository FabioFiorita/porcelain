import type { ChangeDiffContent } from '../../src/models/change-diff.ts';
import type { ReadChangeDiffsInput } from '../../src/models/read-change-diffs.ts';
import type { ChangeDiffReader } from '../../src/ports/change-diff-reader.ts';

export function diffKey(comparison: {
  scope: string;
  oldPath: string | undefined;
  newPath: string | undefined;
}): string {
  return `${comparison.scope}\0${comparison.oldPath ?? ''}\0${comparison.newPath ?? ''}`;
}

export class ScriptedChangeDiffReader implements ChangeDiffReader {
  private readonly diffs: ReadonlyMap<string, ChangeDiffContent>;

  constructor(diffs: ReadonlyMap<string, ChangeDiffContent>) {
    this.diffs = diffs;
  }

  readDiffs(input: ReadChangeDiffsInput): Promise<ChangeDiffContent[]> {
    return Promise.resolve(
      input.comparisons
        .map((comparison) => this.diffs.get(diffKey(comparison)))
        .filter((content) => content !== undefined),
    );
  }
}

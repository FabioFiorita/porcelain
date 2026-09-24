import type { ChangeDiffContent } from '../../src/models/change-diff.ts';
import type { ChangeDiffReader } from '../../src/ports/change-diff-reader.ts';

export class ScriptedChangeDiffReader implements ChangeDiffReader {
  readonly contents: ChangeDiffContent[] = [];

  readDiffs(): Promise<ChangeDiffContent[]> {
    return Promise.resolve(this.contents);
  }
}

import { WorktreeChangedError } from '../errors/worktree-changed-error.ts';
import type {
  ChangeDiffs,
  ChangeSelection,
  ExpectedFile,
} from '../models/change-diff.ts';
import {
  fingerprintChange,
  logicalPath,
  orderComparisons,
} from '../models/fingerprint-change.ts';
import type { ChangeComparison } from '../models/change.ts';
import type { ChangeInspectionReader } from '../ports/change-inspection-reader.ts';

const MAX_SELECTIONS = 200;

export class ReadChangeDiffsService {
  private readonly reader: ChangeInspectionReader;

  constructor(reader: ChangeInspectionReader) {
    this.reader = reader;
  }

  async execute(
    worktreeId: string,
    expectedStatusToken: string,
    expectedFiles: readonly ExpectedFile[],
    selections: readonly ChangeSelection[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffs> {
    signal?.throwIfAborted();
    if (selections.length === 0 || selections.length > MAX_SELECTIONS)
      throw new WorktreeChangedError();
    const { environmentId, status: observed } =
      await this.reader.readStatus(signal);
    if (observed.statusToken !== expectedStatusToken)
      throw new WorktreeChangedError();
    const wanted = selections.map((selection) => {
      const change = observed.changes.find(
        (entry) =>
          (entry.scope === 'staged' || entry.scope === 'unstaged') &&
          entry.scope === selection.scope &&
          entry.oldPath === selection.oldPath &&
          entry.newPath === selection.newPath,
      );
      if (
        !change ||
        change.scope === 'untracked' ||
        change.scope === 'unmerged'
      )
        throw new WorktreeChangedError();
      return change;
    });
    const paths = wanted.map((change) => logicalPath(change));
    const stamped = await this.confirmFingerprints(
      observed.changes,
      paths,
      expectedFiles,
      signal,
    );
    const contents = await this.reader.readDiffs(wanted, signal);
    signal?.throwIfAborted();
    const { status: after } = await this.reader.readStatus(signal);
    if (after.statusToken !== expectedStatusToken)
      throw new WorktreeChangedError();
    const restamped = await this.confirmFingerprints(
      after.changes,
      paths,
      expectedFiles,
      signal,
    );
    if (restamped !== stamped) throw new WorktreeChangedError();
    await this.reader.confirmReachable(worktreeId, signal);
    return {
      environmentId,
      worktreeId,
      statusToken: observed.statusToken,
      diffs: wanted.map((change, index) => {
        const content = contents[index];
        if (!content) throw new Error('Missing diff result');
        return {
          selection: {
            scope: change.scope,
            oldPath: change.oldPath,
            newPath: change.newPath,
          },
          content,
        };
      }),
    };
  }

  private async confirmFingerprints(
    changes: readonly ChangeComparison[],
    paths: readonly string[],
    expectedFiles: readonly ExpectedFile[],
    signal?: AbortSignal,
  ): Promise<string> {
    const selected = new Set(paths);
    const relevant = changes.filter((change) =>
      selected.has(logicalPath(change)),
    );
    const { sides, stamps } = await this.reader.observeSides(relevant, signal);
    const expected = new Map(
      expectedFiles.map((file) => [file.path, file.fingerprint]),
    );
    if (expected.size !== selected.size) throw new WorktreeChangedError();
    for (const path of selected) {
      if (!expected.has(path)) throw new WorktreeChangedError();
      const comparisons = orderComparisons(
        relevant.filter((change) => logicalPath(change) === path),
      );
      const current = fingerprintChange(path, comparisons, (file) =>
        sides.get(file),
      );
      if (current !== (expected.get(path) ?? undefined))
        throw new WorktreeChangedError();
    }
    return [
      ...[...stamps].sort(([left], [right]) => left.localeCompare(right)),
      ['\0index', await this.reader.stampIndex()],
    ]
      .map(([path, stamp]) => `${path}\u0000${stamp}`)
      .join('\u0000');
  }
}

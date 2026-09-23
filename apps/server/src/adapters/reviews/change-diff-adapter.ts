import type {
  ChangeDiff,
  ChangeDiffContent as InspectedContent,
  ChangeFingerprints,
  ChangeStatusObservation,
  ConfirmDiffObservationInput,
  DiffSelection,
  ReadChangeDiffsInput,
  ReadChangeFingerprintsInput,
  SelectDiffComparisonsInput,
  Worktree,
  WorktreeInput,
} from '@porcelain/changes/models';
import type {
  ChangeDiffContent,
  ChangeDiffs,
  ChangeSelection,
  ExpectedFile,
} from '@porcelain/reviews/models';
import type { ChangeDiffReader } from '@porcelain/reviews/ports';

type DiffReading = {
  checkWorktree: {
    execute(input: WorktreeInput, signal?: AbortSignal): Promise<Worktree>;
  };
  readWorktreeStatus: {
    execute(
      input: WorktreeInput,
      signal?: AbortSignal,
    ): Promise<ChangeStatusObservation>;
  };
  selectDiffComparisons: {
    execute(input: SelectDiffComparisonsInput): DiffSelection;
  };
  readChangeFingerprints: {
    execute(
      input: ReadChangeFingerprintsInput,
      signal?: AbortSignal,
    ): Promise<ChangeFingerprints>;
  };
  confirmDiffObservation: {
    execute(input: ConfirmDiffObservationInput): void;
  };
  readChangeDiffs: {
    execute(
      input: ReadChangeDiffsInput,
      signal?: AbortSignal,
    ): Promise<ChangeDiff[]>;
  };
};

function content(inspected: InspectedContent): ChangeDiffContent {
  return inspected.kind === 'omitted' ? { kind: 'omitted' } : inspected;
}

export class ChangeDiffAdapter implements ChangeDiffReader {
  private readonly changes: DiffReading;

  constructor(changes: DiffReading) {
    this.changes = changes;
  }

  async read(
    worktreeId: string,
    statusToken: string,
    expectedFiles: readonly ExpectedFile[],
    selections: readonly ChangeSelection[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffs> {
    const expected = expectedFiles.map((file) => ({
      path: file.path,
      fingerprint: file.fingerprint,
    }));
    await this.changes.checkWorktree.execute({ worktreeId }, signal);
    const before = await this.changes.readWorktreeStatus.execute(
      { worktreeId },
      signal,
    );
    const selected = this.changes.selectDiffComparisons.execute({
      expectedFiles: expected,
      selections: selections.map((selection) => ({
        scope: selection.scope,
        oldPath: selection.oldPath,
        newPath: selection.newPath,
      })),
      status: before,
    });
    const observed = await this.changes.readChangeFingerprints.execute(
      { worktreeId, comparisons: before.changes, paths: selected.paths },
      signal,
    );
    this.changes.confirmDiffObservation.execute({
      expectedStatusToken: statusToken,
      expectedFiles: expected,
      statusToken: before.statusToken,
      fingerprints: observed,
      previousStamp: undefined,
    });
    const diffs = await this.changes.readChangeDiffs.execute(
      { worktreeId, comparisons: selected.comparisons },
      signal,
    );
    const after = await this.changes.readWorktreeStatus.execute(
      { worktreeId },
      signal,
    );
    const reobserved = await this.changes.readChangeFingerprints.execute(
      { worktreeId, comparisons: after.changes, paths: selected.paths },
      signal,
    );
    this.changes.confirmDiffObservation.execute({
      expectedStatusToken: statusToken,
      expectedFiles: expected,
      statusToken: after.statusToken,
      fingerprints: reobserved,
      previousStamp: observed.stamp,
    });
    await this.changes.checkWorktree.execute({ worktreeId }, signal);
    return {
      diffs: diffs.map((diff) => ({
        selection: diff.selection,
        content: content(diff.content),
      })),
    };
  }
}

import { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { FileChange } from '@porcelain/kernel/models';
import { isTracked, utf8ByteLength } from '@porcelain/kernel/rules';
import { CommitDraftSelectionError } from '../errors/commit-draft-selection-error.ts';
import { CommitDraftTooLargeError } from '../errors/commit-draft-too-large-error.ts';
import type {
  CaptureCommitDraftInput,
  CaptureCommitDraftOptions,
  CaptureCommitDraftResult,
} from '../models/capture-commit-draft.ts';
import type {
  CommitDraftEvidence,
  CommitDraftUntrackedContent,
} from '../models/commit-draft-evidence.ts';
import type { FingerprintedFile } from '../models/fingerprinted-file.ts';
import type { SelectedDiffReader } from '../ports/selected-diff-reader.ts';
import type { UntrackedFileReader } from '../ports/untracked-file-reader.ts';
import { changedPaths } from '../rules/changed-paths.ts';
import { untrackedEvidence } from '../rules/untracked-evidence.ts';

export class CaptureCommitDraftService<E = never> {
  private readonly selectedDiffReader: SelectedDiffReader<E>;
  private readonly untrackedFileReader: UntrackedFileReader;
  private readonly options: CaptureCommitDraftOptions;

  constructor(
    selectedDiffReader: SelectedDiffReader<E>,
    untrackedFileReader: UntrackedFileReader,
    options: CaptureCommitDraftOptions,
  ) {
    this.selectedDiffReader = selectedDiffReader;
    this.untrackedFileReader = untrackedFileReader;
    this.options = options;
  }

  execute(
    input: CaptureCommitDraftInput,
  ): Effect.Effect<
    CaptureCommitDraftResult,
    CommitDraftSelectionError | CommitDraftTooLargeError | E,
    WorktreeRead
  > {
    return Effect.gen({ self: this }, function* () {
      const { observation } = input;
      const paths = [...new Set(input.paths)];
      const selected = observation.changes.filter((change) =>
        paths.includes(change.path),
      );
      const allowed = new Set(selected.flatMap(changedPaths));
      const expectedFiles = selected.flatMap((change): FingerprintedFile[] =>
        change.fingerprint === undefined
          ? []
          : [{ path: change.path, fingerprint: change.fingerprint }],
      );
      if (
        paths.some((path) => !allowed.has(path)) ||
        expectedFiles.length !== selected.length
      )
        return yield* Effect.fail(new CommitDraftSelectionError());
      const evidence = JSON.stringify(
        yield* this.evidence(input.worktreeId, observation.headOid, selected),
      );
      if (utf8ByteLength(evidence) > this.options.maxEvidenceBytes)
        return yield* Effect.fail(new CommitDraftTooLargeError());
      return {
        paths,
        bundles: selected.map((change) =>
          [...new Set(changedPaths(change))].filter((path) =>
            paths.includes(path),
          ),
        ),
        evidence,
        expectedFiles,
      };
    });
  }

  private evidence(
    worktreeId: string,
    headOid: string | undefined,
    selected: readonly FileChange[],
  ): Effect.Effect<
    CommitDraftEvidence,
    CommitDraftSelectionError | CommitDraftTooLargeError | E,
    WorktreeRead
  > {
    return Effect.gen({ self: this }, function* () {
      const compared = selected.flatMap((change) =>
        change.comparisons.filter(isTracked),
      );
      if (compared.length > this.options.maxComparisons)
        return yield* Effect.fail(new CommitDraftTooLargeError());
      const diffable = selected.filter((change) =>
        change.comparisons.some(isTracked),
      );
      const patch =
        diffable.length === 0
          ? ''
          : yield* this.selectedDiffReader.read({
              worktreeId,
              headOid,
              paths: [...new Set(diffable.flatMap(changedPaths))],
            });
      const untracked: Record<string, CommitDraftUntrackedContent> = {};
      for (const change of selected)
        for (const comparison of change.comparisons)
          if (comparison.scope === 'untracked')
            untracked[comparison.path] = untrackedEvidence(
              worktreeId,
              comparison.path,
              yield* this.untrackedFileReader.read({
                worktreeId,
                path: comparison.path,
                maxBytes: this.options.maxUntrackedBytes,
              }),
            );
      return {
        files: selected.map((change) => ({
          path: change.path,
          fingerprint: change.fingerprint,
          comparisons: change.comparisons,
        })),
        patch,
        untracked,
      };
    });
  }
}

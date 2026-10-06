import { CaptureCommitDraftOptions } from '../ports/capture-commit-draft-options.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type FileChange } from '@porcelain/kernel/models';
import { isTracked, utf8ByteLength } from '@porcelain/kernel/rules';
import { CommitDraftSelectionError } from '../errors/commit-draft-selection-error.ts';
import { CommitDraftTooLargeError } from '../errors/commit-draft-too-large-error.ts';
import {
  type CaptureCommitDraftInput,
  type CaptureCommitDraftResult,
} from '../models/capture-commit-draft.ts';
import {
  type CommitDraftEvidence,
  type CommitDraftUntrackedContent,
} from '../models/commit-draft-evidence.ts';
import { type FingerprintedFile } from '../models/fingerprinted-file.ts';
import { SelectedDiffReader } from '../ports/selected-diff-reader.ts';
import { UntrackedFileReader } from '../ports/untracked-file-reader.ts';
import { changedPaths } from '../rules/changed-paths.ts';
import { untrackedEvidence } from '../rules/untracked-evidence.ts';

export class CaptureCommitDraftService extends Context.Service<
  CaptureCommitDraftService,
  {
    readonly execute: (
      input: CaptureCommitDraftInput,
    ) => Effect.Effect<
      CaptureCommitDraftResult,
      CommitDraftSelectionError | CommitDraftTooLargeError | GitIoFailure,
      WorktreeRead
    >;
  }
>()('@porcelain/git-actions/CaptureCommitDraftService') {
  static readonly layer = Layer.effect(
    CaptureCommitDraftService,
    Effect.gen(function* () {
      const selectedDiffReaderCapability = yield* SelectedDiffReader;
      const untrackedFileReaderCapability = yield* UntrackedFileReader;
      const optionsCapability = yield* CaptureCommitDraftOptions;
      const operationEvidence = Effect.fn('CaptureCommitDraftService.evidence')(
        function* (
          worktreeId: string,
          headOid: string | undefined,
          selected: readonly FileChange[],
        ): Effect.fn.Return<
          CommitDraftEvidence,
          CommitDraftSelectionError | CommitDraftTooLargeError | GitIoFailure,
          WorktreeRead
        > {
          const compared = selected.flatMap((change) =>
            change.comparisons.filter(isTracked),
          );
          if (compared.length > optionsCapability.maxComparisons)
            return yield* Effect.fail(new CommitDraftTooLargeError());
          const diffable = selected.filter((change) =>
            change.comparisons.some(isTracked),
          );
          const patch =
            diffable.length === 0
              ? ''
              : yield* selectedDiffReaderCapability.read({
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
                  yield* untrackedFileReaderCapability.read({
                    worktreeId,
                    path: comparison.path,
                    maxBytes: optionsCapability.maxUntrackedBytes,
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
        },
      );
      return {
        execute: Effect.fn('CaptureCommitDraftService.execute')(function* (
          input: CaptureCommitDraftInput,
        ): Effect.fn.Return<
          CaptureCommitDraftResult,
          CommitDraftSelectionError | CommitDraftTooLargeError | GitIoFailure,
          WorktreeRead
        > {
          const { observation } = input;
          const paths = [...new Set(input.paths)];
          const selected = observation.changes.filter((change) =>
            paths.includes(change.path),
          );
          const allowed = new Set(selected.flatMap(changedPaths));
          const expectedFiles = selected.flatMap(
            (change): FingerprintedFile[] =>
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
            yield* operationEvidence(
              input.worktreeId,
              observation.headOid,
              selected,
            ),
          );
          if (utf8ByteLength(evidence) > optionsCapability.maxEvidenceBytes)
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
        }),
      };
    }),
  );
}

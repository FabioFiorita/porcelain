import type { FileChange } from '@porcelain/kernel/models';
import { isTracked, utf8ByteLength } from '@porcelain/kernel/rules';
import { CommitDraftSelectionError } from '../errors/commit-draft-selection-error.ts';
import { CommitDraftTooLargeError } from '../errors/commit-draft-too-large-error.ts';
import type {
  CaptureCommitDraftInput,
  CaptureCommitDraftResult,
} from '../models/capture-commit-draft.ts';
import type { CommitDraftUntrackedContent } from '../models/commit-draft-evidence.ts';
import type { FingerprintedFile } from '../models/fingerprinted-file.ts';
import type { SelectedDiffReader } from '../ports/selected-diff-reader.ts';
import type { UntrackedFileReader } from '../ports/untracked-file-reader.ts';
import { changedPaths } from '../rules/changed-paths.ts';
import { untrackedEvidence } from '../rules/untracked-evidence.ts';

export type CaptureCommitDraftOptions = {
  maxComparisons: number;
  maxEvidenceBytes: number;
  maxUntrackedBytes: number;
};

export class CaptureCommitDraftService {
  private readonly selectedDiffReader: SelectedDiffReader;
  private readonly untrackedFileReader: UntrackedFileReader;
  private readonly options: CaptureCommitDraftOptions;

  constructor(
    selectedDiffReader: SelectedDiffReader,
    untrackedFileReader: UntrackedFileReader,
    options: CaptureCommitDraftOptions,
  ) {
    this.selectedDiffReader = selectedDiffReader;
    this.untrackedFileReader = untrackedFileReader;
    this.options = options;
  }

  async execute(
    input: CaptureCommitDraftInput,
    signal?: AbortSignal,
  ): Promise<CaptureCommitDraftResult> {
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
      throw new CommitDraftSelectionError();
    const evidence = JSON.stringify(
      await this.evidence(
        input.worktreeId,
        observation.headOid,
        selected,
        signal,
      ),
    );
    if (utf8ByteLength(evidence) > this.options.maxEvidenceBytes)
      throw new CommitDraftTooLargeError();
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
  }

  private async evidence(
    worktreeId: string,
    headOid: string | undefined,
    selected: readonly FileChange[],
    signal: AbortSignal | undefined,
  ) {
    const compared = selected.flatMap((change) =>
      change.comparisons.filter(isTracked),
    );
    if (compared.length > this.options.maxComparisons)
      throw new CommitDraftTooLargeError();
    const diffable = selected.filter((change) =>
      change.comparisons.some(isTracked),
    );
    const patch =
      diffable.length === 0
        ? ''
        : await this.selectedDiffReader.read(
            {
              worktreeId,
              headOid,
              paths: [...new Set(diffable.flatMap(changedPaths))],
            },
            signal,
          );
    const untracked: Record<string, CommitDraftUntrackedContent> = {};
    for (const change of selected)
      for (const comparison of change.comparisons)
        if (comparison.scope === 'untracked')
          untracked[comparison.path] = untrackedEvidence(
            worktreeId,
            comparison.path,
            await this.untrackedFileReader.read(
              {
                worktreeId,
                path: comparison.path,
                maxBytes: this.options.maxUntrackedBytes,
              },
              signal,
            ),
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
  }
}

import { CommitDraftSelectionError } from '../errors/commit-draft-selection-error.ts';
import { CommitDraftTooLargeError } from '../errors/commit-draft-too-large-error.ts';
import { CommitDraftUnavailableError } from '../errors/commit-draft-unavailable-error.ts';
import { WorktreeChangedError } from '../errors/worktree-changed-error.ts';
import type { CommitDraftCapture } from '../models/commit-draft.ts';
import type { CommitDraftChange } from '../models/commit-draft-change.ts';
import type { CaptureCommitDraftInput } from '../models/commit-draft-operations.ts';
import type { ExpectedFile } from '../models/expected-file.ts';
import type { CommitDraftReader } from '../ports/commit-draft-reader.ts';
import type { CommitDraftSnapshotReader } from '../ports/commit-draft-snapshot-reader.ts';

const MAX_COMPARISONS = 200;
const MAX_EVIDENCE_BYTES = 1024 * 1024;

export class CaptureCommitDraftService {
  private readonly commitDraftReader: CommitDraftReader;

  constructor(commitDraftReader: CommitDraftReader) {
    this.commitDraftReader = commitDraftReader;
  }

  async execute(
    input: CaptureCommitDraftInput,
    signal?: AbortSignal,
  ): Promise<CommitDraftCapture> {
    const snapshot = this.commitDraftReader.open(input, signal);
    const observed = await snapshot.changes();
    if (observed.statusToken !== input.expectedStatusToken)
      throw new WorktreeChangedError();
    const paths = [...new Set(input.paths)];
    const selected = observed.changes.filter((change) =>
      paths.includes(change.path),
    );
    const allowed = new Set(selected.flatMap(changedPaths));
    const expectedFiles = selected.flatMap((change): ExpectedFile[] =>
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
      await this.evidence(observed.headOid, selected, snapshot, signal),
    );
    if (new TextEncoder().encode(evidence).length > MAX_EVIDENCE_BYTES)
      throw new CommitDraftTooLargeError();
    await snapshot.confirm();
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
    headOid: string | undefined,
    selected: readonly CommitDraftChange[],
    snapshot: CommitDraftSnapshotReader,
    signal: AbortSignal | undefined,
  ) {
    const compared = selected.flatMap((change) =>
      change.comparisons.filter(
        (comparison) =>
          comparison.scope === 'staged' || comparison.scope === 'unstaged',
      ),
    );
    if (compared.length > MAX_COMPARISONS) throw new CommitDraftTooLargeError();
    const diffable = selected.filter((change) =>
      change.comparisons.some(
        (comparison) =>
          comparison.scope === 'staged' || comparison.scope === 'unstaged',
      ),
    );
    const patch =
      diffable.length === 0
        ? ''
        : await snapshot.selectedDiff(headOid, [
            ...new Set(diffable.flatMap(changedPaths)),
          ]);
    if (patch === undefined) throw new CommitDraftUnavailableError();
    const untracked: Record<string, unknown> = {};
    for (const change of selected)
      for (const comparison of change.comparisons)
        if (comparison.scope === 'untracked') {
          signal?.throwIfAborted();
          untracked[comparison.path] = await snapshot.untracked(
            comparison.path,
          );
        }
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

function changedPaths(change: CommitDraftChange): string[] {
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

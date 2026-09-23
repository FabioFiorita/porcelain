import { CommitDraftError } from '../errors/commit-draft-error.ts';
import { WorktreeChangedError } from '../errors/worktree-changed-error.ts';
import type { CommitDraftChange } from '../models/commit-draft-change.ts';
import type {
  CommitDraftCapture,
  CommitDraftInput,
} from '../models/commit-draft.ts';
import type { GitActionScope } from '../models/git-action.ts';
import type {
  CommitDraftCapturePort,
  CommitDraftCaptureReaderPort,
} from '../ports/commit-draft-capture-port.ts';

const MAX_DRAFT_COMPARISONS = 200;

export class CaptureCommitDraftService {
  private readonly capture: CommitDraftCapturePort;

  constructor(capture: CommitDraftCapturePort) {
    this.capture = capture;
  }

  async execute(
    scope: GitActionScope,
    input: CommitDraftInput,
    signal: AbortSignal,
  ): Promise<CommitDraftCapture> {
    const reader = this.capture.open(scope, signal);
    const observed = await reader.readChanges();
    if (observed.statusToken !== input.expectedStatusToken)
      throw new WorktreeChangedError();
    const paths = [...new Set(input.paths)];
    const selected = observed.changes.filter((entry) =>
      paths.includes(entry.path),
    );
    const allowed = new Set(
      selected.flatMap((entry) => [entry.path, ...changedPaths(entry)]),
    );
    if (
      paths.some((path) => !allowed.has(path)) ||
      selected.some((entry) => typeof entry.fingerprint !== 'string')
    )
      throw new CommitDraftError(
        'Select readable changed files to generate a commit draft.',
      );
    const prompt = JSON.stringify(
      await this.contents(observed.headOid, selected, reader, signal),
    );
    if (Buffer.byteLength(prompt) > 1024 * 1024)
      throw new CommitDraftError(
        'Select fewer files to generate a commit draft.',
      );
    await reader.confirm();
    return {
      paths,
      bundles: selected.map((entry) =>
        [...new Set([entry.path, ...changedPaths(entry)])].filter((path) =>
          paths.includes(path),
        ),
      ),
      prompt,
      expectedFiles: selected.map((entry) => {
        if (typeof entry.fingerprint !== 'string')
          throw new CommitDraftError(
            'Select readable changed files to generate a commit draft.',
          );
        return { path: entry.path, fingerprint: entry.fingerprint };
      }),
    };
  }

  private async contents(
    headOid: string | null,
    selected: readonly CommitDraftChange[],
    reader: CommitDraftCaptureReaderPort,
    signal: AbortSignal,
  ) {
    const diffable = selected.filter((entry) =>
      entry.comparisons.some(
        (change) => change.scope === 'staged' || change.scope === 'unstaged',
      ),
    );
    const selections = diffable.flatMap((entry) =>
      entry.comparisons.flatMap((change) =>
        change.scope === 'staged' || change.scope === 'unstaged'
          ? [
              {
                scope: change.scope,
                oldPath: change.oldPath,
                newPath: change.newPath,
              },
            ]
          : [],
      ),
    );
    if (selections.length > MAX_DRAFT_COMPARISONS)
      throw new CommitDraftError(
        'Select fewer files to generate a commit draft.',
      );
    const patch = await reader.readSelectedDiff(headOid, [
      ...new Set(
        diffable.flatMap((entry) => [entry.path, ...changedPaths(entry)]),
      ),
    ]);
    if (diffable.length > 0 && patch === undefined)
      throw new CommitDraftError('Commit drafting is unavailable.');
    const paths = selected.flatMap((entry) =>
      entry.comparisons.flatMap((change) =>
        change.scope === 'untracked' ? [change.path] : [],
      ),
    );
    const untracked = new Map<string, unknown>();
    for (const path of paths) {
      signal.throwIfAborted();
      untracked.set(path, await reader.readUntracked(path));
    }
    return {
      files: selected.map((entry) => ({
        path: entry.path,
        fingerprint: entry.fingerprint,
        comparisons: entry.comparisons,
      })),
      patch: patch ?? '',
      untracked: Object.fromEntries(untracked),
    };
  }
}

function changedPaths(entry: CommitDraftChange): string[] {
  return entry.comparisons.flatMap((change) =>
    'path' in change
      ? [change.path]
      : [change.oldPath, change.newPath].filter(
          (path): path is string => typeof path === 'string',
        ),
  );
}

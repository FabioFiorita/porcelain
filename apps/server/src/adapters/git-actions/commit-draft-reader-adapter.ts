import type { ReadChangesResult } from '@porcelain/changes/models';
import type { FileReader } from '@porcelain/files/ports';
import type {
  CommitDraftComparison,
  CommitDraftObservation,
  CommitDraftUntrackedContent,
  GitActionScope,
} from '@porcelain/git-actions/models';
import type {
  CommitDraftReader,
  CommitDraftSnapshotReader,
} from '@porcelain/git-actions/ports';
import {
  RequestGitSession,
  type GitActionWriterFactory,
} from '@porcelain/git/actions';
import type { ActionCheckouts } from './action-checkout.ts';
import type { WorktreeChanges } from './worktree-fingerprint-reader-adapter.ts';

type Comparison = ReadChangesResult['changes'][number]['comparisons'][number];

export class CommitDraftReaderAdapter implements CommitDraftReader {
  private readonly changes: Pick<WorktreeChanges, 'execute'>;
  private readonly checkouts: ActionCheckouts;
  private readonly git: GitActionWriterFactory;
  private readonly files: Pick<FileReader, 'read'>;

  constructor(
    changes: Pick<WorktreeChanges, 'execute'>,
    checkouts: ActionCheckouts,
    git: GitActionWriterFactory,
    files: Pick<FileReader, 'read'>,
  ) {
    this.changes = changes;
    this.checkouts = checkouts;
    this.git = git;
    this.files = files;
  }

  open(scope: GitActionScope, signal?: AbortSignal): CommitDraftSnapshotReader {
    const session = new RequestGitSession();
    const operationSignal = signal ?? new AbortController().signal;
    let root: Promise<string> | undefined;
    return {
      changes: async (): Promise<CommitDraftObservation> => {
        const observed = await this.changes.execute(
          scope.worktreeId,
          session,
          signal,
        );
        return {
          statusToken: observed.statusToken,
          headOid: observed.headOid ?? undefined,
          changes: observed.changes.map((change) => ({
            path: change.path,
            fingerprint: change.fingerprint ?? undefined,
            comparisons: change.comparisons.map(comparison),
          })),
        };
      },
      selectedDiff: async (headOid, paths) => {
        const { checkout } = await this.checkouts.resolve(
          scope,
          session,
          signal,
        );
        return this.git(checkout).readSelectedDiff?.(
          headOid ?? null,
          paths,
          operationSignal,
        );
      },
      untracked: async (path): Promise<CommitDraftUntrackedContent> => {
        root ??= this.checkouts
          .resolve(scope, session, signal)
          .then(({ worktree }) => worktree.path);
        const worktreeRoot = await root;
        signal?.throwIfAborted();
        try {
          const content = await this.files.read(
            { worktreeId: scope.worktreeId, root: worktreeRoot, path },
            signal,
          );
          return { kind: 'file', ...content };
        } catch (error) {
          signal?.throwIfAborted();
          const reason = failureCode(error);
          if (reason === undefined) throw error;
          return { kind: 'omitted', reason };
        }
      },
      confirm: () => session.confirmAll(signal),
    };
  }
}

function comparison(value: Comparison): CommitDraftComparison {
  if ('path' in value) return value;
  return {
    ...value,
    oldPath: value.oldPath ?? undefined,
    newPath: value.newPath ?? undefined,
    oldOid: value.oldOid ?? undefined,
    newOid: value.newOid ?? undefined,
  };
}

function failureCode(error: unknown): string | undefined {
  return error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}

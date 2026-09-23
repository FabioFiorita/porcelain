import type { FileReader } from '@porcelain/files/ports';
import type {
  CommitDraftObservation,
  CommitDraftUntrackedContent,
  GitActionScope,
} from '@porcelain/git-actions/models';
import type {
  CommitDraftReader,
  CommitDraftSnapshotReader,
} from '@porcelain/git-actions/ports';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import { RequestGitSession } from '@porcelain/git/inspection';
import type { ActionCheckouts } from './action-checkout.ts';
import type { WorktreeChangeReading } from './worktree-fingerprint-reader-adapter.ts';

export class CommitDraftReaderAdapter implements CommitDraftReader {
  private readonly changes: WorktreeChangeReading;
  private readonly checkouts: ActionCheckouts;
  private readonly git: GitActionWriterFactory;
  private readonly files: Pick<FileReader, 'readText'>;
  private readonly untrackedMaxBytes: number;

  constructor(
    changes: WorktreeChangeReading,
    checkouts: ActionCheckouts,
    git: GitActionWriterFactory,
    files: Pick<FileReader, 'readText'>,
    untrackedMaxBytes: number,
  ) {
    this.changes = changes;
    this.checkouts = checkouts;
    this.git = git;
    this.files = files;
    this.untrackedMaxBytes = untrackedMaxBytes;
  }

  open(scope: GitActionScope, signal?: AbortSignal): CommitDraftSnapshotReader {
    const session = new RequestGitSession();
    const operationSignal = signal ?? new AbortController().signal;
    return {
      changes: async (): Promise<CommitDraftObservation> => {
        const { worktreeId } = scope;
        const status = await this.changes.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const observed = await this.changes.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        return {
          statusToken: status.statusToken,
          headOid: status.headOid,
          changes: observed.changes,
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
        const read = await this.files.readText(
          { worktreeId: scope.worktreeId, path },
          this.untrackedMaxBytes,
          signal,
        );
        if (read.kind === 'too-large')
          return { kind: 'omitted', reason: 'too-large' };
        if (read.kind === 'failed')
          return { kind: 'omitted', reason: read.failure };
        return {
          kind: 'file',
          worktreeId: scope.worktreeId,
          path,
          encoding: 'utf-8',
          byteLength: read.byteLength,
          text: read.text,
        };
      },
      confirm: () => session.confirmAll(signal),
    };
  }
}

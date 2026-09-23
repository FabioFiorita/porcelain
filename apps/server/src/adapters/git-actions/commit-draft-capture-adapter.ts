import type {
  CommitDraftObservation,
  GitActionScope,
} from '@porcelain/git-actions/models';
import type { CommitDraftCapturePort } from '@porcelain/git-actions/ports';
import { FileInspectionError } from '@porcelain/files/errors';
import type { FileReader } from '@porcelain/files/ports';
import { RequestGitSession } from '@porcelain/git/actions';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import type { GitSession } from '@porcelain/git/inspection';

type Checkout = Parameters<GitActionWriterFactory>[0];

export class CommitDraftCaptureAdapter implements CommitDraftCapturePort {
  private readonly readChanges: (
    worktreeId: string,
    session: GitSession,
    signal: AbortSignal,
  ) => Promise<CommitDraftObservation>;
  private readonly resolveCheckout: (
    scope: GitActionScope,
    session: GitSession,
    signal: AbortSignal,
  ) => Promise<{ checkout: Checkout; root: string }>;
  private readonly git: GitActionWriterFactory;
  private readonly files: Pick<FileReader, 'read'>;

  constructor(
    readChanges: (
      worktreeId: string,
      session: GitSession,
      signal: AbortSignal,
    ) => Promise<CommitDraftObservation>,
    resolveCheckout: (
      scope: GitActionScope,
      session: GitSession,
      signal: AbortSignal,
    ) => Promise<{ checkout: Checkout; root: string }>,
    git: GitActionWriterFactory,
    files: Pick<FileReader, 'read'>,
  ) {
    this.readChanges = readChanges;
    this.resolveCheckout = resolveCheckout;
    this.git = git;
    this.files = files;
  }

  open(scope: GitActionScope, signal: AbortSignal) {
    const session = new RequestGitSession();
    let untrackedRoot: Promise<string> | undefined;
    return {
      readChanges: () => this.readChanges(scope.worktreeId, session, signal),
      readSelectedDiff: async (
        headOid: string | null,
        paths: readonly string[],
      ) => {
        const { checkout } = await this.resolveCheckout(scope, session, signal);
        const writer = this.git(checkout);
        if (paths.length === 0) return '';
        return writer.readSelectedDiff?.(headOid, paths, signal);
      },
      readUntracked: async (path: string) => {
        untrackedRoot ??= this.resolveCheckout(scope, session, signal).then(
          (resolved) => resolved.root,
        );
        const root = await untrackedRoot;
        signal.throwIfAborted();
        try {
          const content = await this.files.read(
            { worktreeId: scope.worktreeId, root, path },
            signal,
          );
          return { kind: 'file' as const, ...content };
        } catch (error) {
          signal.throwIfAborted();
          if (!(error instanceof FileInspectionError)) throw error;
          return { kind: 'omitted' as const, reason: error.code };
        }
      },
      confirm: () => session.confirmAll(signal),
    };
  }
}

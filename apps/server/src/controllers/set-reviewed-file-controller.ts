import type {
  ReviewedFileChange,
  ReviewedFilesResult,
  SetReviewedFileInput,
} from '@porcelain/reviews/models';
import type { SetReviewedFileService } from '@porcelain/reviews/services';

type WorktreeAccess = {
  forWriting(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
};
type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class SetReviewedFileController<Session> {
  private readonly worktrees: WorktreeAccess;
  private readonly setReviewedFile: SetReviewedFileService;
  private readonly createSession: () => Session;
  private readonly observeChanges: (
    worktreeId: string,
    session: Session,
    signal: AbortSignal,
  ) => Promise<{ changes: { path: string; fingerprint: string | null }[] }>;
  private readonly confirmSession: (
    session: Session,
    signal: AbortSignal,
  ) => Promise<void>;
  private readonly runWorktreeRead: RunWorktreeRead;
  private readonly publishReviewedChanged: (worktreeId: string) => void;

  constructor(
    worktrees: WorktreeAccess,
    setReviewedFile: SetReviewedFileService,
    createSession: () => Session,
    observeChanges: (
      worktreeId: string,
      session: Session,
      signal: AbortSignal,
    ) => Promise<{ changes: { path: string; fingerprint: string | null }[] }>,
    confirmSession: (session: Session, signal: AbortSignal) => Promise<void>,
    runWorktreeRead: RunWorktreeRead,
    publishReviewedChanged: (worktreeId: string) => void,
  ) {
    this.worktrees = worktrees;
    this.setReviewedFile = setReviewedFile;
    this.createSession = createSession;
    this.observeChanges = observeChanges;
    this.confirmSession = confirmSession;
    this.runWorktreeRead = runWorktreeRead;
    this.publishReviewedChanged = publishReviewedChanged;
  }

  async execute(
    input: { worktreeId: string } & SetReviewedFileInput,
    context: { signal?: AbortSignal },
  ): Promise<ReviewedFilesResult> {
    const submitted = { ...input };
    const result = await this.runWorktreeRead(
      input.worktreeId,
      async (signal) => {
        await this.worktrees.forWriting(input.worktreeId, signal);
        const session = this.createSession();
        const observed = await this.observeChanges(
          input.worktreeId,
          session,
          signal,
        );
        const changes: ReviewedFileChange[] = observed.changes.map(
          ({ path, fingerprint }) => ({
            path,
            ...(fingerprint === null ? {} : { fingerprint }),
          }),
        );
        return this.setReviewedFile.execute(
          input.worktreeId,
          submitted,
          changes,
          () => this.confirmSession(session, signal),
        );
      },
      context.signal,
    );
    this.publishReviewedChanged(input.worktreeId);
    return result;
  }
}

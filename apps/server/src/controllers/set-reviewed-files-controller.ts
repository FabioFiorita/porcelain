import type {
  ReviewedFileChange,
  SetReviewedFilesInput,
  SetReviewedFilesResult,
} from '@porcelain/reviews/models';
import type { SetReviewedFilesService } from '@porcelain/reviews/services';

type WorktreeAccess = {
  forWriting(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
};
type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class SetReviewedFilesController<Session> {
  private readonly worktrees: WorktreeAccess;
  private readonly setReviewedFiles: SetReviewedFilesService;
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
    setReviewedFiles: SetReviewedFilesService,
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
    this.setReviewedFiles = setReviewedFiles;
    this.createSession = createSession;
    this.observeChanges = observeChanges;
    this.confirmSession = confirmSession;
    this.runWorktreeRead = runWorktreeRead;
    this.publishReviewedChanged = publishReviewedChanged;
  }

  async execute(
    input: { worktreeId: string } & SetReviewedFilesInput,
    context: { signal?: AbortSignal },
  ): Promise<SetReviewedFilesResult> {
    const submitted = { files: input.files.map((file) => ({ ...file })) };
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
        return this.setReviewedFiles.execute(
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

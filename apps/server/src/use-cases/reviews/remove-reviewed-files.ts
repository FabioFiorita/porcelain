import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  RemoveReviewedFileQuery,
  RemoveReviewedFilesRequest,
  RemoveReviewedFilesResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { RemoveReviewedFilesService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class RemoveReviewedFilesUseCase {
  private readonly access: WorktreeAccess;
  private readonly removeReviewedFiles: RemoveReviewedFilesService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    removeReviewedFiles: RemoveReviewedFilesService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.removeReviewedFiles = removeReviewedFiles;
    this.events = events;
  }

  execute(
    input: WorktreeParams &
      (RemoveReviewedFileQuery | RemoveReviewedFilesRequest),
  ): Effect.Effect<RemoveReviewedFilesResponse, WorktreeAccessFailure> {
    return this.access
      .transaction(
        input.worktreeId,
        () => Effect.void,
        () =>
          this.removeReviewedFiles.execute({
            worktreeId: input.worktreeId,
            scope: input.scope,
            branch: input.scope === 'branch' ? input.branch : undefined,
            paths: 'paths' in input ? input.paths : [input.path],
          }),
        (value) =>
          Effect.sync(() => {
            if (value.removed)
              this.events.worktreeChanged({
                worktreeId: input.worktreeId,
                change: 'reviewed',
              });
          }),
      )
      .pipe(
        Effect.map((value) => (({ removed, ...response }) => response)(value)),
      );
  }
}

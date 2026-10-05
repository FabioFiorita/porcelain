import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  RemoveReviewedLayerQuery,
  RemoveReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  RemoveReviewedLayerService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class RemoveReviewedLayerUseCase {
  private readonly access: WorktreeAccess;
  private readonly removeReviewedLayer: RemoveReviewedLayerService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    removeReviewedLayer: RemoveReviewedLayerService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readTextFiles: ReadTextFilesService,
    listReviewedLayers: ListReviewedLayersService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.removeReviewedLayer = removeReviewedLayer;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readTextFiles = readTextFiles;
    this.listReviewedLayers = listReviewedLayers;
    this.events = events;
  }

  execute(
    input: WorktreeParams & RemoveReviewedLayerQuery,
  ): Effect.Effect<RemoveReviewedLayerResponse, WorktreeAccessFailure> {
    const { worktreeId } = input;
    return this.access
      .transaction(
        worktreeId,
        () =>
          Effect.gen({ self: this }, function* () {
            const { paths } = yield* this.listReviewedLayerPaths.execute({
              worktreeId,
            });
            return yield* this.readTextFiles.execute({ worktreeId, paths });
          }),
        ({ texts }) =>
          Effect.gen({ self: this }, function* () {
            const { removed } = yield* this.removeReviewedLayer.execute(input);
            return {
              removed,
              ...(yield* this.listReviewedLayers.execute({
                worktreeId,
                texts,
              })),
            };
          }),
        ({ removed }) =>
          Effect.sync(() => {
            if (removed)
              this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
          }),
      )
      .pipe(Effect.map(({ removed, ...response }) => response));
  }
}

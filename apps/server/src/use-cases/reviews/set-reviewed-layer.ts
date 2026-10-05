import type {
  ReviewLayerNotFoundError,
  ReviewedMarkConflictError,
} from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type {
  SetReviewedLayerRequest,
  SetReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  ReadReviewLayerService,
  SetReviewedLayerService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class SetReviewedLayerUseCase {
  private readonly access: WorktreeAccess;
  private readonly readReviewLayer: ReadReviewLayerService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly setReviewedLayer: SetReviewedLayerService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    readReviewLayer: ReadReviewLayerService,
    readTextFiles: ReadTextFilesService,
    setReviewedLayer: SetReviewedLayerService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    listReviewedLayers: ListReviewedLayersService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.readReviewLayer = readReviewLayer;
    this.readTextFiles = readTextFiles;
    this.setReviewedLayer = setReviewedLayer;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.listReviewedLayers = listReviewedLayers;
    this.events = events;
  }

  execute(
    input: WorktreeParams & SetReviewedLayerRequest,
  ): Effect.Effect<
    SetReviewedLayerResponse,
    WorktreeAccessFailure | ReviewLayerNotFoundError | ReviewedMarkConflictError
  > {
    const { worktreeId } = input;
    return this.access.transaction(
      worktreeId,
      () =>
        Effect.gen({ self: this }, function* () {
          const { layer, paths } = yield* this.readReviewLayer.execute({
            worktreeId,
            layerId: input.layerId,
          });
          const marked = yield* this.listReviewedLayerPaths.execute({
            worktreeId,
          });
          const { texts } = yield* this.readTextFiles.execute({
            worktreeId,
            paths: [...new Set([...paths, ...marked.paths])],
          });
          return { layer, texts };
        }),
      ({ layer, texts }) =>
        Effect.gen({ self: this }, function* () {
          yield* this.setReviewedLayer.execute({
            worktreeId,
            layer,
            fingerprint: input.fingerprint,
            texts,
          });
          return yield* this.listReviewedLayers.execute({ worktreeId, texts });
        }),
      () =>
        Effect.sync(() =>
          this.events.worktreeChanged({ worktreeId, change: 'reviewed' }),
        ),
    );
  }
}

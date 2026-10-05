import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
} from '@porcelain/reviews/services';

export class ListReviewedLayersUseCase {
  private readonly access: WorktreeAccess;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly listReviewedLayers: ListReviewedLayersService;

  constructor(
    access: WorktreeAccess,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readTextFiles: ReadTextFilesService,
    listReviewedLayers: ListReviewedLayersService,
  ) {
    this.access = access;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readTextFiles = readTextFiles;
    this.listReviewedLayers = listReviewedLayers;
  }

  execute(
    input: WorktreeParams,
  ): Effect.Effect<ListReviewedLayersResponse, WorktreeAccessFailure> {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      return yield* this.access.reviews(worktreeId, 'read', () =>
        Effect.gen({ self: this }, function* () {
          const { paths: marked } = yield* this.listReviewedLayerPaths.execute({
            worktreeId,
          });
          const listed = yield* this.readTextFiles.execute({
            worktreeId,
            paths: marked,
          });
          return yield* this.listReviewedLayers.execute({
            worktreeId,
            texts: listed.texts,
          });
        }),
      );
    });
  }
}

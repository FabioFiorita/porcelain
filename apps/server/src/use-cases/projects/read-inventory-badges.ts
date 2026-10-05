import { Effect } from 'effect';
import type { ReviewBadges } from '@porcelain/kernel/models';
import type { ReadInventoryBadgesInput } from '../../ports/read-inventory-badges-use-case-port.ts';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type { ReviewTexts } from '@porcelain/reviews/models';
import type {
  ListReviewedLayerPathsService,
  ReadReviewBadgesService,
} from '@porcelain/reviews/services';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ReadInventoryBadgesUseCase {
  private readonly access: WorktreeAccess;
  private readonly paths: ListReviewedLayerPathsService;
  private readonly texts: ReadTextFilesService;
  private readonly statuses: ReadReviewBadgesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    access: WorktreeAccess,
    paths: ListReviewedLayerPathsService,
    texts: ReadTextFilesService,
    statuses: ReadReviewBadgesService,
    lanes: Lanes,
    keys: LaneKeys,
  ) {
    this.access = access;
    this.paths = paths;
    this.texts = texts;
    this.statuses = statuses;
    this.lanes = lanes;
    this.laneKeys = keys;
  }

  execute(input: ReadInventoryBadgesInput): Effect.Effect<ReviewBadges> {
    return Effect.forEach(
      input.listings,
      ({ worktrees }) => {
        const [first] = worktrees;
        if (!first) return Effect.succeed<ReviewBadges>(new Map());
        return Effect.gen({ self: this }, function* () {
          const pathsByWorktree = yield* this.lanes.run(
            this.laneKeys.reviews(first),
            'read',
            () =>
              Effect.forEach(worktrees, (worktree) =>
                this.paths
                  .execute({ worktreeId: worktree.id })
                  .pipe(
                    Effect.map(({ paths }) => [worktree.id, paths] as const),
                  ),
              ),
          );
          const paths = new Map(pathsByWorktree);
          const pairs = yield* Effect.forEach(
            worktrees,
            (worktree) =>
              Effect.gen({ self: this }, function* () {
                const texts = this.access
                  .read(worktree.id, () =>
                    this.texts.execute({
                      worktreeId: worktree.id,
                      paths: paths.get(worktree.id) ?? [],
                    }),
                  )
                  .pipe(
                    Effect.map((read): ReviewTexts => read.texts),
                    Effect.orElseSucceed((): ReviewTexts => new Map()),
                  );
                return [worktree.id, yield* texts] as const;
              }),
            { concurrency: 'unbounded' },
          );
          return yield* this.lanes.run(
            this.laneKeys.reviews(first),
            'read',
            () =>
              this.statuses
                .execute({
                  worktreeIds: worktrees.map((worktree) => worktree.id),
                  texts: new Map(pairs),
                })
                .pipe(Effect.map(({ statuses }) => statuses)),
          );
        });
      },
      { concurrency: 'unbounded' },
    ).pipe(
      Effect.map(
        (badges) => new Map(badges.flatMap((statuses) => [...statuses])),
      ),
    );
  }
}

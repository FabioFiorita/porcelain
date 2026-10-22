import { Context, Effect, Layer } from 'effect';
import { ListProjectReviewsService } from '@porcelain/reviews/services';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type {
  ProjectReviewParams,
  listProjectReviewsResponseSchema,
} from '@porcelain/contracts/reviews';
import { reviewRecordView } from '@porcelain/reviews/rules';

export class ListProjectReviewsUseCase extends Context.Service<
  ListProjectReviewsUseCase,
  {
    readonly execute: (
      input: ProjectReviewParams,
    ) => Effect.Effect<typeof listProjectReviewsResponseSchema.Type, never>;
  }
>()('@porcelain/server/ListProjectReviewsUseCase') {
  static readonly layer = Layer.effect(
    ListProjectReviewsUseCase,
    Effect.gen(function* () {
      const operation = yield* ListProjectReviewsService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ListProjectReviewsUseCase.execute')(
          function* (input) {
            return yield* lanes.run(
              keys.reviews({
                repositoryId: `project-reviews:${input.projectId}`,
              }),
              'read',
              () =>
                Effect.gen(function* () {
                  return (yield* operation.execute(input)).map(
                    reviewRecordView,
                  );
                }),
            );
          },
        ),
      };
    }),
  );
}

import { Context, Effect, Layer } from 'effect';
import type {
  ReviewAgentFeedbackResponse,
  ReviewParams,
} from '@porcelain/contracts/reviews';
import type {
  AgentFeedbackConflictError,
  ReviewNotFoundError,
} from '@porcelain/reviews/errors';
import { ReadReviewAgentFeedbackService } from '@porcelain/reviews/services';

import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class AgentFeedbackUseCase extends Context.Service<
  AgentFeedbackUseCase,
  {
    readonly execute: (
      input: ReviewParams,
    ) => Effect.Effect<
      ReviewAgentFeedbackResponse,
      ReviewNotFoundError | AgentFeedbackConflictError
    >;
  }
>()('@porcelain/server/AgentFeedbackUseCase') {
  static readonly layer = Layer.effect(
    AgentFeedbackUseCase,
    Effect.gen(function* () {
      const read = yield* ReadReviewAgentFeedbackService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('AgentFeedbackUseCase.execute')(function* (input) {
          return yield* lanes.run(
            keys.reviews({ repositoryId: `review:${input.reviewId}` }),
            'read',
            () => read.execute(input),
          );
        }),
      };
    }),
  );
}

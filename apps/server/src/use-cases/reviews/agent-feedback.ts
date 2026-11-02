import { Context, Effect, Layer } from 'effect';
import type {
  ReviewAgentFeedbackOperation,
  ReviewAgentFeedbackResponse,
} from '@porcelain/contracts/reviews';
import type {
  AgentFeedbackConflictError,
  ReviewNotFoundError,
} from '@porcelain/reviews/errors';
import { AgentFeedbackService } from '@porcelain/reviews/services';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class AgentFeedbackUseCase extends Context.Service<
  AgentFeedbackUseCase,
  {
    readonly execute: (
      input: ReviewAgentFeedbackOperation,
    ) => Effect.Effect<
      ReviewAgentFeedbackResponse,
      ReviewNotFoundError | AgentFeedbackConflictError
    >;
  }
>()('@porcelain/server/AgentFeedbackUseCase') {
  static readonly layer = Layer.effect(
    AgentFeedbackUseCase,
    Effect.gen(function* () {
      const operation = yield* AgentFeedbackService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('AgentFeedbackUseCase.execute')(function* (input) {
          const result = yield* lanes.run(
            keys.reviews({ repositoryId: `review:${input.reviewId}` }),
            'write',
            () => operation.execute(input),
            {
              succeeded: (value) =>
                input.kind === 'read'
                  ? Effect.void
                  : events.worktreeChanged({
                      worktreeId: value.worktreeId,
                      change: 'review',
                    }),
            },
          );
          if (input.kind !== 'read') yield* events.inventoryChanged();
          return result.feedback;
        }),
      };
    }),
  );
}

import type { Context } from 'effect';
import { Effect } from 'effect';
import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '@porcelain/access/models';
import type { IdentifyRequestClientService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';

export class IdentifyRequestClientUseCase {
  private readonly identifyRequestClient: Context.Service.Shape<
    typeof IdentifyRequestClientService
  >;
  private readonly lanes: Lanes;

  constructor(
    identifyRequestClient: Context.Service.Shape<
      typeof IdentifyRequestClientService
    >,
    lanes: Lanes,
  ) {
    this.identifyRequestClient = identifyRequestClient;
    this.lanes = lanes;
  }

  execute(
    input: IdentifyRequestClientInput,
  ): Effect.Effect<RequestClient, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.unqueued(() =>
        Effect.gen({ self: this }, function* () {
          return yield* this.identifyRequestClient.execute(input);
        }),
      );
    });
  }
}

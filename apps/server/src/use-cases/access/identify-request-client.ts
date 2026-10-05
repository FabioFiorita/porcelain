import { Effect } from 'effect';
import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '@porcelain/access/models';
import type { IdentifyRequestClientService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';

export class IdentifyRequestClientUseCase {
  private readonly identifyRequestClient: IdentifyRequestClientService;
  private readonly lanes: Lanes;

  constructor(
    identifyRequestClient: IdentifyRequestClientService,
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

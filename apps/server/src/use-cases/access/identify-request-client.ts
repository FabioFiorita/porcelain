import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '@porcelain/access/models';
import type { IdentifyRequestClientService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

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
    context: OperationContext,
  ): Promise<RequestClient> {
    return this.lanes.unqueued(
      async () => this.identifyRequestClient.execute(input),
      { callerSignal: context.signal },
    );
  }
}

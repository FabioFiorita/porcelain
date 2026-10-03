import type {
  CheckLocalRequestInput,
  CheckLocalRequestResult,
} from '@porcelain/access/models';
import type { CheckLocalRequestService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class CheckLocalRequestUseCase {
  private readonly checkLocalRequest: CheckLocalRequestService;
  private readonly lanes: Lanes;

  constructor(checkLocalRequest: CheckLocalRequestService, lanes: Lanes) {
    this.checkLocalRequest = checkLocalRequest;
    this.lanes = lanes;
  }

  execute(
    input: CheckLocalRequestInput,
    context: OperationContext,
  ): Promise<CheckLocalRequestResult> {
    return this.lanes.unqueued(
      async () => this.checkLocalRequest.execute(input),
      { callerSignal: context.signal },
    );
  }
}

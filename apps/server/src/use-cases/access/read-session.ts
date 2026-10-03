import type {
  ReadSessionRequest,
  ReadSessionResponse,
} from '@porcelain/contracts/access';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class ReadSessionUseCase {
  private readonly lanes: Lanes;

  constructor(lanes: Lanes) {
    this.lanes = lanes;
  }

  execute(
    input: ReadSessionRequest,
    context: OperationContext,
  ): Promise<ReadSessionResponse> {
    return this.lanes.unqueued(async () => input.viewer, {
      callerSignal: context.signal,
    });
  }
}

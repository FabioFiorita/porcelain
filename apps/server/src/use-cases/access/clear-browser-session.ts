import type { ClearBrowserSessionResponse } from '@porcelain/contracts/access';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class ClearBrowserSessionUseCase {
  private readonly lanes: Lanes;

  constructor(lanes: Lanes) {
    this.lanes = lanes;
  }

  execute(context: OperationContext): Promise<ClearBrowserSessionResponse> {
    return this.lanes.unqueued(
      async (): Promise<ClearBrowserSessionResponse> => undefined,
      { callerSignal: context.signal },
    );
  }
}

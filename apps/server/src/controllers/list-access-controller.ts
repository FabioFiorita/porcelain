import type { ListAccessResponse } from '@porcelain/contracts/access';
import type { ListAccessService } from '@porcelain/access/services';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ListAccessController {
  private readonly listAccessService: ListAccessService;
  private readonly lanes: Lanes;

  constructor(listAccessService: ListAccessService, lanes: Lanes) {
    this.listAccessService = listAccessService;
    this.lanes = lanes;
  }

  execute(
    input: Record<never, never>,
    context: OperationContext,
  ): Promise<ListAccessResponse> {
    return this.lanes.unqueued(
      async () => this.listAccessService.execute(input),
      { callerSignal: context.signal },
    );
  }
}

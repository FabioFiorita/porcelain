import type { ReadOwnerStatusResponse } from '@porcelain/contracts/access';
import type { ReadOwnerStatusService } from '@porcelain/access/services';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadOwnerStatusController {
  private readonly readOwnerStatusService: ReadOwnerStatusService;

  constructor(readOwnerStatusService: ReadOwnerStatusService) {
    this.readOwnerStatusService = readOwnerStatusService;
  }

  execute(
    input: Record<never, never>,
    context: OperationContext,
  ): ReadOwnerStatusResponse {
    context.signal?.throwIfAborted();
    return this.readOwnerStatusService.execute(input);
  }
}

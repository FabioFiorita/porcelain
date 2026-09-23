import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadHealthController {
  private readonly readEnvironmentService: ReadEnvironmentService;

  constructor(readEnvironmentService: ReadEnvironmentService) {
    this.readEnvironmentService = readEnvironmentService;
  }

  execute(
    input: Record<never, never>,
    context: OperationContext,
  ): ReadHealthResponse {
    context.signal?.throwIfAborted();
    const { environmentId } = this.readEnvironmentService.execute(input);
    return { status: 'ok', environmentId };
  }
}

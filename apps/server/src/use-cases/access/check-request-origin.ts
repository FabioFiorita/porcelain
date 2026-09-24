import type {
  CheckRequestOriginInput,
  RequestOriginRefusal,
} from '@porcelain/access/models';
import type { CheckRequestOriginService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export type RequestOriginVerdict =
  | { allowed: true }
  | { allowed: false; refusal: RequestOriginRefusal };

export class CheckRequestOriginUseCase {
  private readonly checkRequestOrigin: CheckRequestOriginService;
  private readonly lanes: Lanes;

  constructor(checkRequestOrigin: CheckRequestOriginService, lanes: Lanes) {
    this.checkRequestOrigin = checkRequestOrigin;
    this.lanes = lanes;
  }

  execute(
    input: CheckRequestOriginInput,
    context: OperationContext,
  ): Promise<RequestOriginVerdict> {
    return this.lanes.unqueued(
      async (): Promise<RequestOriginVerdict> => {
        const result = this.checkRequestOrigin.execute(input);
        return result.kind === 'allowed'
          ? { allowed: true }
          : { allowed: false, refusal: result.refusal };
      },
      { callerSignal: context.signal },
    );
  }
}

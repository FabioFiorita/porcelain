import type {
  CheckRequestOriginInput,
  RequestOriginRefusal,
} from '@porcelain/access/models';
import { requestOriginCheck } from '@porcelain/access/rules';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export type RequestOriginVerdict =
  | { allowed: true }
  | { allowed: false; refusal: RequestOriginRefusal };

export class CheckRequestOriginUseCase {
  private readonly lanes: Lanes;

  constructor(lanes: Lanes) {
    this.lanes = lanes;
  }

  execute(
    input: CheckRequestOriginInput,
    context: OperationContext,
  ): Promise<RequestOriginVerdict> {
    return this.lanes.unqueued(
      async (): Promise<RequestOriginVerdict> => {
        const result = requestOriginCheck(input);
        return result.kind === 'allowed'
          ? { allowed: true }
          : { allowed: false, refusal: result.refusal };
      },
      { callerSignal: context.signal },
    );
  }
}

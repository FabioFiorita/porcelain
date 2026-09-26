import type {
  CheckRequestOriginInput,
  RequestOriginRefusal,
} from '@porcelain/access/models';
import type { OperationContext } from './operation-context.ts';

export type RequestOriginVerdict =
  | { allowed: true }
  | { allowed: false; refusal: RequestOriginRefusal };

export interface CheckRequestOriginUseCasePort {
  execute(
    input: CheckRequestOriginInput,
    context: OperationContext,
  ): Promise<RequestOriginVerdict>;
}

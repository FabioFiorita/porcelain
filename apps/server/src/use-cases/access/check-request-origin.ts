import type {
  CheckRequestOriginInput,
  RequestOriginRefusal,
} from '@porcelain/access/models';
import { requestOriginCheck } from '@porcelain/access/rules';

export type RequestOriginVerdict =
  | { allowed: true }
  | { allowed: false; refusal: RequestOriginRefusal };

export class CheckRequestOriginUseCase {
  execute(input: CheckRequestOriginInput): RequestOriginVerdict {
    const result = requestOriginCheck(input);
    return result.kind === 'allowed'
      ? { allowed: true }
      : { allowed: false, refusal: result.refusal };
  }
}

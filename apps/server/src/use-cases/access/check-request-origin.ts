import type { CheckRequestOriginInput } from '@porcelain/access/models';
import { requestOriginCheck } from '@porcelain/access/rules';

export type RequestOriginVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

export class CheckRequestOriginUseCase {
  execute(input: CheckRequestOriginInput): RequestOriginVerdict {
    const result = requestOriginCheck(input);
    return result.kind === 'allowed'
      ? { allowed: true }
      : { allowed: false, reason: result.reason };
  }
}

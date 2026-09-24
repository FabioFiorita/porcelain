import type { CheckRequestOriginInput } from '@porcelain/access/models';
import type { CheckRequestOriginService } from '@porcelain/access/services';

export type RequestOriginVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

export class CheckRequestOriginUseCase {
  private readonly checkRequestOrigin: CheckRequestOriginService;

  constructor(checkRequestOrigin: CheckRequestOriginService) {
    this.checkRequestOrigin = checkRequestOrigin;
  }

  execute(input: CheckRequestOriginInput): RequestOriginVerdict {
    const result = this.checkRequestOrigin.execute(input);
    return result.kind === 'allowed'
      ? { allowed: true }
      : { allowed: false, reason: result.reason };
  }
}
